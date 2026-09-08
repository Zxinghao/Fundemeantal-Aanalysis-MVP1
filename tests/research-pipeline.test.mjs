import test from "node:test";
import assert from "node:assert/strict";

import { cadenceDue, eventFromSource, mergeEventStore } from "../scripts/web-scan.mjs";
import { applyEventReviewStatuses, applyReviews } from "../scripts/apply-review-decisions.mjs";
import { computeCompositeScore, classifyComposite, validateResearchPacket } from "../scripts/research-model.mjs";

const rubric = {
  dimensions: {
    supplyChainImportance: { weight: 0.20 },
    scarcity: { weight: 0.20 },
    pricingPower: { weight: 0.10 },
    switchingCost: { weight: 0.15 },
    validationBarrier: { weight: 0.15 },
    marketUnderappreciation: { weight: 0.20 }
  },
  classifications: [
    { min: 80, label: "High-conviction hidden bottleneck candidate" },
    { min: 70, label: "Hidden bottleneck candidate" },
    { min: 60, label: "Watchlist / partial bottleneck" },
    { min: 0, label: "Not currently a hidden bottleneck" }
  ]
};

test("persistent event store keeps an older pending event when a later scan detects nothing", () => {
  const existing = [{
    id: "event-1",
    status: "pending",
    industryId: "fuel-cell",
    detectedAt: "2026-09-01T10:00:00.000Z"
  }];

  const result = mergeEventStore(existing, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "event-1");
  assert.equal(result[0].status, "pending");
});

test("persistent event store appends a distinct later event instead of replacing history", () => {
  const existing = [{
    id: "event-old",
    status: "pending",
    industryId: "fuel-cell",
    detectedAt: "2026-09-01T10:00:00.000Z"
  }];
  const detected = [{
    id: "event-new",
    status: "pending",
    industryId: "fuel-cell",
    detectedAt: "2026-09-08T10:00:00.000Z"
  }];

  const result = mergeEventStore(existing, detected);
  assert.deepEqual(result.map((event) => event.id), ["event-new", "event-old"]);
});

test("reviewed scanner status is not reset to pending by the same detected event", () => {
  const existing = [{
    id: "event-1",
    status: "approved",
    reviewDecision: "approved",
    reviewedAt: "2026-09-07T12:00:00.000Z",
    detectedAt: "2026-09-07T10:00:00.000Z"
  }];
  const detected = [{
    id: "event-1",
    status: "pending",
    reviewDecision: null,
    reviewedAt: null,
    detectedAt: "2026-09-07T13:00:00.000Z"
  }];

  const [event] = mergeEventStore(existing, detected);
  assert.equal(event.status, "approved");
  assert.equal(event.reviewDecision, "approved");
  assert.equal(event.reviewedAt, "2026-09-07T12:00:00.000Z");
  assert.equal(event.lastSeenAt, "2026-09-07T13:00:00.000Z");
});

test("weekly sources are not due the next day but are due after a week", () => {
  const previous = { lastCheckedAt: "2026-09-01T06:15:00.000Z" };
  assert.equal(cadenceDue("weekly", previous, "2026-09-02T06:15:00.000Z"), false);
  assert.equal(cadenceDue("weekly", previous, "2026-09-08T06:15:00.000Z"), true);
  assert.equal(cadenceDue("daily", previous, "2026-09-02T06:15:00.000Z"), true);
});

test("exported review decisions persist scanner-event state", () => {
  const events = [{ id: "scan-1", status: "pending", reviewDecision: null, reviewedAt: null }];
  const reviewExport = {
    exportedAt: "2026-09-08T12:00:00.000Z",
    reviewedItems: [{ id: "scan-1", reviewStatus: "needs_more_evidence" }]
  };

  const result = applyEventReviewStatuses(events, reviewExport);
  assert.deepEqual(result.updatedIds, ["scan-1"]);
  assert.equal(result.events[0].status, "needs_more_evidence");
  assert.equal(result.events[0].reviewDecision, "needs_more_evidence");
  assert.equal(result.events[0].reviewedAt, reviewExport.exportedAt);
});

test("rejected review updates status without adding a reviewed company note", () => {
  const industries = [{
    id: "fuel-cell",
    name: "Fuel Cell",
    nodes: [{ id: "forvia" }],
    relationships: [],
    sources: [],
    companies: [{ id: "forvia", name: "FORVIA", recentUpdates: [] }],
    updateEvents: [{
      id: "map-event",
      status: "pending",
      reviewDecision: null,
      reviewedAt: null
    }]
  }];
  const reviewExport = {
    exportedAt: "2026-09-08T12:00:00.000Z",
    reviewedItems: [{
      id: "map-event",
      industryId: "fuel-cell",
      companyId: "forvia",
      company: "FORVIA",
      summary: "Unconfirmed claim",
      reviewStatus: "rejected"
    }]
  };

  const applied = applyReviews(industries, reviewExport);
  assert.deepEqual(applied, ["map-event"]);
  assert.equal(industries[0].updateEvents[0].status, "rejected");
  assert.equal(industries[0].companies[0].recentUpdates.length, 0);
});

test("scanner event separates observed evidence from an unverified claim and non-executable draft patch", () => {
  const event = eventFromSource({
    industryId: "fuel-cell",
    source: {
      id: "forvia-news",
      name: "FORVIA newsroom",
      sourceType: "company_official",
      url: "https://example.com/forvia",
      companyId: "forvia",
      nodeId: "tank",
      watchFor: ["hydrogen", "capacity", "order"]
    },
    title: "Hydrogen storage update",
    hits: ["hydrogen", "capacity"],
    date: "2026-09-08",
    detectedAt: "2026-09-08T10:00:00.000Z"
  });

  assert.equal(event.researchPacket.schemaVersion, "1.0");
  assert.equal(event.researchPacket.evidence[0].evidenceLevel, "A");
  assert.match(event.researchPacket.evidence[0].observation, /hydrogen, capacity/);
  assert.equal(event.researchPacket.claim.status, "unverified");
  assert.equal(event.researchPacket.claim.confidence, "medium");
  assert.equal(event.researchPacket.proposedPatch.status, "draft");
  assert.equal(event.researchPacket.proposedPatch.executable, false);
  assert.equal(event.researchPacket.proposedPatch.operations[0].requiresHumanInput, true);
});

test("hidden bottleneck composite is deterministic from versioned weights", () => {
  const score = computeCompositeScore({
    supplyChainImportance: 92,
    scarcity: 88,
    pricingPower: 78,
    switchingCost: 85,
    validationBarrier: 90,
    marketUnderappreciation: 74
  }, rubric);

  assert.equal(score, 84.9);
  assert.equal(classifyComposite(score, rubric), "High-conviction hidden bottleneck candidate");
});

test("approved executable research patch can update a whitelisted score field", () => {
  const industries = [{
    id: "fuel-cell",
    name: "Fuel Cell",
    nodes: [{ id: "forvia" }],
    relationships: [],
    sources: [],
    companies: [{
      id: "forvia",
      name: "FORVIA",
      scores: { validationBarrier: 82 },
      recentUpdates: [],
      signals: {}
    }],
    updateEvents: []
  }];

  const reviewExport = {
    exportedAt: "2026-09-08T12:00:00.000Z",
    reviewedItems: [{
      id: "scan-1",
      industryId: "fuel-cell",
      companyId: "forvia",
      company: "FORVIA",
      impact: "bottleneck_judgement",
      source: "https://example.com/source",
      sourceIds: [],
      summary: "Qualification evidence strengthened.",
      reviewStatus: "approved",
      researchPacket: {
        schemaVersion: "1.0",
        evidence: [{ id: "e1", sourceId: "source", evidenceLevel: "A", observation: "Verified qualification disclosure." }],
        claim: {
          id: "c1",
          status: "supported",
          type: "bottleneck_judgement",
          target: "company:forvia",
          statement: "Qualification evidence supports a higher validation barrier.",
          confidence: "high"
        },
        proposedPatch: {
          status: "ready",
          executable: true,
          operations: [{
            op: "replace",
            path: "companies.forvia.scores.validationBarrier",
            value: 86,
            reason: "Verified qualification evidence.",
            requiresHumanInput: false
          }]
        }
      }
    }]
  };

  applyReviews(industries, reviewExport);
  assert.equal(industries[0].companies[0].scores.validationBarrier, 86);
  assert.equal(industries[0].companies[0].recentUpdates.length, 0);
  assert.deepEqual(industries[0].updateEvents[0].patchApplied, ["companies.forvia.scores.validationBarrier"]);
});

test("approved draft research packet does not silently become an official company note", () => {
  const industries = [{
    id: "fuel-cell",
    name: "Fuel Cell",
    nodes: [{ id: "forvia" }],
    relationships: [],
    sources: [],
    companies: [{ id: "forvia", name: "FORVIA", recentUpdates: [] }],
    updateEvents: []
  }];

  const reviewExport = {
    exportedAt: "2026-09-08T12:00:00.000Z",
    reviewedItems: [{
      id: "scan-draft",
      industryId: "fuel-cell",
      companyId: "forvia",
      company: "FORVIA",
      summary: "Page changed; exact disclosure still needs verification.",
      reviewStatus: "approved",
      researchPacket: {
        schemaVersion: "1.0",
        evidence: [{ id: "e1", sourceId: "source", evidenceLevel: "A", observation: "Page changed." }],
        claim: {
          id: "c1",
          status: "unverified",
          target: "company:forvia",
          statement: "Potential change.",
          confidence: "low"
        },
        proposedPatch: {
          status: "draft",
          executable: false,
          operations: [{ op: "review", path: "companies.forvia.recentUpdates", value: null, requiresHumanInput: true }]
        }
      }
    }]
  };

  applyReviews(industries, reviewExport);
  assert.equal(industries[0].companies[0].recentUpdates.length, 0);
  assert.deepEqual(industries[0].updateEvents[0].patchApplied, []);
});

test("executable patch is invalid unless its claim is explicitly supported", () => {
  const errors = validateResearchPacket({
    schemaVersion: "1.0",
    evidence: [{ sourceId: "source", evidenceLevel: "A", observation: "Verified disclosure." }],
    claim: {
      status: "unverified",
      target: "company:forvia",
      statement: "Potential qualification change.",
      confidence: "medium"
    },
    proposedPatch: {
      status: "ready",
      executable: true,
      operations: [{
        op: "replace",
        path: "companies.forvia.scores.validationBarrier",
        value: 86,
        requiresHumanInput: false
      }]
    }
  });

  assert.ok(errors.some((error) => error.includes("claim.status=supported")));
});

test("mixed valid and invalid operations reject the entire research patch atomically", () => {
  const industries = [{
    id: "fuel-cell",
    name: "Fuel Cell",
    nodes: [{ id: "forvia" }],
    relationships: [],
    sources: [],
    companies: [{
      id: "forvia",
      name: "FORVIA",
      scores: { validationBarrier: 82 },
      recentUpdates: [],
      signals: {}
    }],
    updateEvents: []
  }];

  const reviewExport = {
    exportedAt: "2026-09-08T12:00:00.000Z",
    reviewedItems: [{
      id: "scan-atomic",
      industryId: "fuel-cell",
      companyId: "forvia",
      company: "FORVIA",
      impact: "bottleneck_judgement",
      source: "https://example.com/source",
      sourceIds: [],
      summary: "Qualification evidence review.",
      reviewStatus: "approved",
      researchPacket: {
        schemaVersion: "1.0",
        evidence: [{ sourceId: "source", evidenceLevel: "A", observation: "Verified disclosure." }],
        claim: {
          status: "supported",
          target: "company:forvia",
          statement: "Qualification evidence supports a score review.",
          confidence: "high"
        },
        proposedPatch: {
          status: "ready",
          executable: true,
          operations: [
            {
              op: "replace",
              path: "companies.forvia.scores.validationBarrier",
              value: 86,
              requiresHumanInput: false
            },
            {
              op: "replace",
              path: "companies.forvia.scores.notARealDimension",
              value: 99,
              requiresHumanInput: false
            }
          ]
        }
      }
    }]
  };

  applyReviews(industries, reviewExport);
  assert.equal(industries[0].companies[0].scores.validationBarrier, 82);
  assert.equal(industries[0].companies[0].scores.notARealDimension, undefined);
  assert.deepEqual(industries[0].updateEvents[0].patchApplied, []);
  assert.deepEqual(industries[0].updateEvents[0].patchSkipped, [
    "companies.forvia.scores.validationBarrier",
    "companies.forvia.scores.notARealDimension"
  ]);
});
