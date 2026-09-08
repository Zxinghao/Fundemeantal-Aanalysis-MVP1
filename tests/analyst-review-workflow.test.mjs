import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewedPacket,
  validateAnalystReview,
  validateApprovedPacketAuthority
} from "../scripts/analyst-review-model.mjs";
import { applyReviews } from "../scripts/apply-review-decisions.mjs";

function itemFixture() {
  return {
    id: "scan-forvia-1",
    industryId: "fuel-cell",
    companyId: "forvia",
    nodeId: "tank",
    company: "FORVIA",
    impact: "capacity_change",
    origin: "AI scan",
    source: "https://example.com/forvia",
    sourceIds: ["forvia-news"],
    summary: "Potential hydrogen-storage capacity update.",
    researchPacket: {
      schemaVersion: "1.0",
      evidence: [{
        id: "e1",
        sourceId: "forvia-news",
        sourceType: "company_official",
        url: "https://example.com/forvia",
        pageTitle: "FORVIA update",
        observedAt: "2026-09-09T00:00:00.000Z",
        evidenceLevel: "A",
        observation: "Watched context changed around hydrogen storage capacity."
      }],
      claim: {
        id: "c1",
        status: "unverified",
        type: "capacity_change",
        target: "company:forvia",
        statement: "Potential capacity change.",
        confidence: "medium",
        rationale: "Scanner candidate only."
      },
      proposedPatch: {
        status: "draft",
        executable: false,
        operations: []
      },
      llmCandidate: {
        schemaVersion: "1.0",
        status: "candidate",
        generator: { type: "llm_research_agent", model: "gpt-5.6-luna" },
        target: "company:forvia",
        observedFacts: [],
        interpretation: {
          status: "candidate",
          confidence: "medium",
          requiresPrimarySourceVerification: true
        },
        scoreImpact: {
          candidateDimensions: ["supplyChainImportance"],
          direction: null,
          proposedScores: {}
        }
      }
    }
  };
}

function verifiedReview(overrides = {}) {
  return {
    primarySourceVerified: true,
    analystFinding: "FORVIA's official disclosure confirms a material capacity update for hydrogen storage systems.",
    analystRationale: "The primary source states the updated capacity in the relevant business context and the disclosure is attributable to the company.",
    confidence: "high",
    patchMode: "recent_update",
    patchValue: "[Reviewed] FORVIA confirmed a material hydrogen-storage capacity update in its official disclosure.",
    noCanonicalChangeReason: "",
    scoreDimension: "supplyChainImportance",
    scoreValue: "",
    evidenceDate: "2026-09-09",
    scoreRationale: "",
    ...overrides
  };
}

test("structured approval is locked until the primary source is verified", () => {
  const item = itemFixture();
  const errors = validateAnalystReview(item, verifiedReview({ primarySourceVerified: false }));
  assert.ok(errors.some((error) => error.includes("primary source")));
});

test("human review turns an unverified packet into a supported claim without promoting the LLM candidate", () => {
  const item = itemFixture();
  const packet = buildReviewedPacket(item, verifiedReview(), "approved", {
    reviewedAt: "2026-09-09T00:10:00.000Z"
  });

  assert.equal(packet.claim.status, "supported");
  assert.equal(packet.humanReview.status, "verified");
  assert.equal(packet.humanReview.primarySourceVerified, true);
  assert.equal(packet.proposedPatch.status, "ready");
  assert.equal(packet.proposedPatch.executable, true);
  assert.equal(packet.proposedPatch.operations[0].op, "append");
  assert.equal(packet.proposedPatch.operations[0].path, "companies.forvia.recentUpdates");
  assert.equal(packet.llmCandidate.status, "candidate");
  assert.deepEqual(validateApprovedPacketAuthority(packet), []);
});

test("score review emits score and scoreEvidence operations as one atomic pair", () => {
  const item = itemFixture();
  const packet = buildReviewedPacket(item, verifiedReview({
    patchMode: "score",
    scoreDimension: "validationBarrier",
    scoreValue: "86",
    evidenceDate: "2026-09-09",
    scoreRationale: "Verified customer qualification requirements materially increase the validation barrier for replacement suppliers."
  }), "approved", { reviewedAt: "2026-09-09T00:10:00.000Z" });

  assert.equal(packet.proposedPatch.operations.length, 2);
  assert.equal(packet.proposedPatch.operations[0].path, "companies.forvia.scores.validationBarrier");
  assert.equal(packet.proposedPatch.operations[0].value, 86);
  assert.equal(packet.proposedPatch.operations[1].path, "companies.forvia.scoreEvidence.validationBarrier");
  assert.equal(packet.proposedPatch.operations[1].value.score, 86);
  assert.deepEqual(packet.proposedPatch.operations[1].value.sourceIds, ["forvia-news"]);
  assert.equal(packet.proposedPatch.operations[1].value.provenance.eventId, item.id);
  assert.equal(packet.proposedPatch.operations[1].value.provenance.claimId, "c1");
});

test("schema v2 golden path applies a human-verified packet and records provenance", () => {
  const item = itemFixture();
  const review = verifiedReview();
  const reviewedAt = "2026-09-09T00:10:00.000Z";
  const packet = buildReviewedPacket(item, review, "approved", { reviewedAt });
  const industries = [{
    id: "fuel-cell",
    name: "Fuel Cell",
    nodes: [{ id: "tank", summary: "Storage" }],
    relationships: [],
    sources: [],
    companies: [{ id: "forvia", name: "FORVIA", scores: {}, signals: {}, recentUpdates: [] }],
    updateEvents: []
  }];

  const applied = applyReviews(industries, {
    schemaVersion: "2.0",
    exportedAt: reviewedAt,
    reviewedItems: [{
      ...item,
      reviewStatus: "approved",
      analystReview: review,
      researchPacket: packet
    }]
  });

  assert.deepEqual(applied, [item.id]);
  assert.equal(industries[0].companies[0].recentUpdates.length, 1);
  assert.match(industries[0].companies[0].recentUpdates[0], /FORVIA confirmed/);
  assert.equal(industries[0].updateEvents[0].researchPacket.humanReview.status, "verified");
  assert.deepEqual(industries[0].updateEvents[0].patchApplied, ["companies.forvia.recentUpdates"]);
});

test("schema v2 refuses a structured approval that only asserts supported status without human authority", () => {
  const item = itemFixture();
  const forgedPacket = JSON.parse(JSON.stringify(item.researchPacket));
  forgedPacket.claim.status = "supported";
  forgedPacket.proposedPatch = { status: "ready", executable: false, operations: [] };
  const industries = [{
    id: "fuel-cell",
    nodes: [],
    relationships: [],
    sources: [],
    companies: [],
    updateEvents: []
  }];

  assert.throws(() => applyReviews(industries, {
    schemaVersion: "2.0",
    exportedAt: "2026-09-09T00:10:00.000Z",
    reviewedItems: [{ ...item, reviewStatus: "approved", researchPacket: forgedPacket }]
  }), /verified humanReview/);
});
