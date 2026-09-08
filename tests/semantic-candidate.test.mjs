import test from "node:test";
import assert from "node:assert/strict";

import { buildSemanticCandidate, validateSemanticCandidate } from "../scripts/candidate-interpretation.mjs";
import { enrichSemanticCandidates } from "../scripts/enrich-semantic-candidates.mjs";
import { validateSemanticEvent } from "../scripts/validate-semantic-candidates.mjs";

const source = {
  id: "forvia-news",
  companyId: "forvia",
  nodeId: "tank",
  sourceType: "company_official"
};

const comparableChange = {
  status: "comparable",
  method: "watched-context-diff-v1",
  added: ["Hydrogen storage capacity increased to 20,000 systems per year."],
  removed: ["Hydrogen storage capacity was 10,000 systems per year."],
  addedCount: 1,
  removedCount: 1,
  currentRelevant: ["Hydrogen storage capacity increased to 20,000 systems per year."],
  note: "Candidate context changed."
};

test("deterministic semantic candidate isolates a numeric before/after review lead without verifying it", () => {
  const candidate = buildSemanticCandidate({
    source,
    hits: ["hydrogen", "capacity"],
    impactType: "capacity_change",
    changeEvidence: comparableChange,
    detectedAt: "2026-09-08T10:00:00.000Z"
  });

  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.generator.type, "deterministic_heuristic");
  assert.equal(candidate.interpretation.status, "candidate");
  assert.equal(candidate.interpretation.requiresPrimarySourceVerification, true);
  assert.equal(candidate.scoreImpact.status, "review_required");
  assert.equal(candidate.scoreImpact.direction, null);
  assert.deepEqual(candidate.scoreImpact.proposedScores, {});
  assert.ok(candidate.scoreImpact.candidateDimensions.includes("supplyChainImportance"));

  const numeric = candidate.observedFacts.find((fact) => fact.type === "numeric_change_candidate");
  assert.ok(numeric);
  assert.match(numeric.beforeValue, /10,000/);
  assert.match(numeric.afterValue, /20,000/);
  assert.equal(numeric.status, "candidate");
});

test("semantic candidate validation rejects unverified score direction or numeric score proposals", () => {
  const candidate = buildSemanticCandidate({
    source,
    hits: ["hydrogen", "capacity"],
    impactType: "capacity_change",
    changeEvidence: comparableChange
  });

  candidate.scoreImpact.direction = "increase";
  candidate.scoreImpact.proposedScores = { supplyChainImportance: 90 };
  const errors = validateSemanticCandidate(candidate);

  assert.ok(errors.some((error) => error.includes("cannot set a direction")));
  assert.ok(errors.some((error) => error.includes("cannot propose numeric scores")));
});

test("scanner enrichment adds a semantic candidate but leaves claim and patch conservative", () => {
  const events = [{
    id: "web-fuel-cell-2026-09-08-forvia-news",
    sourceType: "ai_scan",
    industryId: "fuel-cell",
    companyId: "forvia",
    nodeId: "tank",
    impactType: "capacity_change",
    detectedAt: "2026-09-08T10:00:00.000Z",
    sourceIds: ["forvia-news"],
    researchPacket: {
      schemaVersion: "1.0",
      evidence: [{
        sourceId: "forvia-news",
        sourceType: "company_official",
        matchedKeywords: ["hydrogen", "capacity"],
        observation: "Watched context changed.",
        evidenceLevel: "A",
        changeSet: comparableChange
      }],
      claim: {
        id: "claim-1",
        status: "unverified",
        target: "company:forvia",
        statement: "Potential capacity change.",
        confidence: "medium"
      },
      proposedPatch: {
        status: "draft",
        executable: false,
        operations: [{ op: "review", path: "companies.forvia.recentUpdates", requiresHumanInput: true }]
      }
    }
  }];
  const watchlist = {
    "fuel-cell": {
      daily: [{ ...source, watchFor: ["hydrogen", "capacity"] }],
      weekly: []
    }
  };

  const result = enrichSemanticCandidates(events, watchlist);
  const packet = result.events[0].researchPacket;
  assert.equal(result.enriched, 1);
  assert.equal(packet.semanticCandidate.status, "candidate");
  assert.equal(packet.claim.status, "unverified");
  assert.equal(packet.proposedPatch.executable, false);
});

test("supported claim is rejected when attached semantic candidate is still only a candidate", () => {
  const candidate = buildSemanticCandidate({
    source,
    hits: ["hydrogen", "capacity"],
    impactType: "capacity_change",
    changeEvidence: comparableChange
  });
  const event = {
    id: "event-1",
    researchPacket: {
      semanticCandidate: candidate,
      claim: { status: "supported" }
    }
  };

  const errors = validateSemanticEvent(event);
  assert.ok(errors.some((error) => error.includes("supported claim cannot rely")));
});

test("deterministic heuristic cannot self-promote semantic candidate to verified", () => {
  const candidate = buildSemanticCandidate({
    source,
    hits: ["hydrogen", "capacity"],
    impactType: "capacity_change",
    changeEvidence: comparableChange
  });
  candidate.status = "verified";
  candidate.interpretation.status = "verified";
  candidate.interpretation.requiresPrimarySourceVerification = false;
  candidate.observedFacts = candidate.observedFacts.map((fact) => ({
    ...fact,
    status: "verified",
    requiresPrimarySourceVerification: false
  }));

  const errors = validateSemanticEvent({
    id: "event-2",
    researchPacket: { semanticCandidate: candidate, claim: { status: "unverified" } }
  });

  assert.ok(errors.some((error) => error.includes("cannot mark itself verified")));
});
