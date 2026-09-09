import test from "node:test";
import assert from "node:assert/strict";

import {
  changeSignature,
  eventFromSource,
  eventIdForChange,
  shouldCreateReviewEvent
} from "../scripts/web-scan.mjs";

const source = {
  id: "forvia-news",
  name: "FORVIA news",
  url: "https://example.com/forvia",
  sourceType: "company_official",
  companyId: "forvia",
  nodeId: "tank",
  watchFor: ["hydrogen", "storage", "commercial vehicle", "tank"]
};

function comparable(overrides = {}) {
  return {
    status: "comparable",
    method: "watched-context-diff-v1",
    added: ["Hydrogen storage capacity increased to 20,000 systems per year."],
    removed: ["Hydrogen storage capacity was 10,000 systems per year."],
    addedCount: 1,
    removedCount: 1,
    currentRelevant: [],
    note: "Relevant watched context changed.",
    ...overrides
  };
}

test("full-page change without watched-context change is suppressed from Review Desk", () => {
  const evidence = comparable({
    added: [],
    removed: [],
    addedCount: 0,
    removedCount: 0
  });

  assert.equal(shouldCreateReviewEvent(evidence), false);
});

test("comparable watched-context change remains review-worthy", () => {
  assert.equal(shouldCreateReviewEvent(comparable()), true);
});

test("baseline migration creates an event only when relevant watched context exists", () => {
  assert.equal(shouldCreateReviewEvent({
    status: "baseline_missing",
    added: [],
    removed: [],
    addedCount: 0,
    removedCount: 0,
    currentRelevant: ["Hydrogen storage systems for commercial vehicles"]
  }), true);

  assert.equal(shouldCreateReviewEvent({
    status: "baseline_missing",
    added: [],
    removed: [],
    addedCount: 0,
    removedCount: 0,
    currentRelevant: []
  }), false);
});

test("same source and same changed evidence produce a stable event ID", () => {
  const evidence = comparable();
  const first = eventIdForChange("fuel-cell", "2026-09-09", source, evidence);
  const second = eventIdForChange("fuel-cell", "2026-09-09", source, JSON.parse(JSON.stringify(evidence)));

  assert.equal(first, second);
  assert.match(first, /^web-fuel-cell-2026-09-09-forvia-news-[a-f0-9]{12}$/);
  assert.equal(changeSignature(evidence).length, 12);
});

test("two distinct disclosures from the same source on the same day do not collide", () => {
  const first = comparable();
  const second = comparable({
    added: ["Hydrogen storage capacity increased to 30,000 systems per year."],
    removed: ["Hydrogen storage capacity was 20,000 systems per year."]
  });

  const firstId = eventIdForChange("fuel-cell", "2026-09-09", source, first);
  const secondId = eventIdForChange("fuel-cell", "2026-09-09", source, second);
  assert.notEqual(firstId, secondId);
});

test("production event override propagates collision-safe ID into research provenance", () => {
  const changeEvidence = comparable();
  const id = eventIdForChange("fuel-cell", "2026-09-09", source, changeEvidence);
  const event = eventFromSource({
    industryId: "fuel-cell",
    source,
    title: "Hydrogen storage update",
    hits: ["hydrogen", "storage"],
    date: "2026-09-09",
    detectedAt: "2026-09-09T06:00:00.000Z",
    changeEvidence,
    eventIdOverride: id
  });

  assert.equal(event.id, id);
  assert.equal(event.changeSignature, changeSignature(changeEvidence));
  assert.equal(event.researchPacket.evidence[0].id, `${id}-evidence-1`);
  assert.equal(event.researchPacket.claim.id, `${id}-claim-1`);
});
