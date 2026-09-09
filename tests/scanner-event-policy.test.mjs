import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import policy from "../scanner-event-policy.js";

function scannerEvent(changeSet = null) {
  return {
    id: "event-1",
    sourceType: "ai_scan",
    industryId: "fuel-cell",
    researchPacket: changeSet
      ? { evidence: [{ changeSet }] }
      : null
  };
}

function reviewCard(id, origin, changeSet = null) {
  return {
    id,
    origin,
    researchPacket: changeSet ? { evidence: [{ changeSet }] } : null
  };
}

test("baseline-only scanner history is not actionable", () => {
  const result = policy.classifyScannerEvent(scannerEvent({
    status: "baseline_missing",
    addedCount: 0,
    removedCount: 0,
    currentRelevant: ["Hydrogen storage context"]
  }));

  assert.equal(result.actionable, false);
  assert.equal(result.category, "operational_baseline");
});

test("legacy scanner event without watched-context evidence is preserved but suppressed", () => {
  const result = policy.classifyScannerEvent(scannerEvent());
  assert.equal(result.actionable, false);
  assert.equal(result.category, "legacy_unverifiable");
});

test("comparable watched-context change is actionable", () => {
  const result = policy.classifyScannerEvent(scannerEvent({
    status: "comparable",
    addedCount: 1,
    removedCount: 1,
    added: ["capacity 20,000"],
    removed: ["capacity 10,000"]
  }));

  assert.equal(result.actionable, true);
  assert.equal(result.category, "comparable_disclosure_change");
});

test("comparable event without a relevant watched-context diff is suppressed", () => {
  const result = policy.classifyScannerEvent(scannerEvent({
    status: "comparable",
    addedCount: 0,
    removedCount: 0
  }));

  assert.equal(result.actionable, false);
  assert.equal(result.category, "no_relevant_diff");
});

test("non-scanner records are outside the scanner gate", () => {
  const result = policy.classifyScannerEvent({ sourceType: "manual_research" });
  assert.equal(result.actionable, true);
  assert.equal(result.category, "not_scanner_event");
});

test("current historical fuel-cell shape summarizes as three suppressed records", () => {
  const events = [
    scannerEvent({ status: "baseline_missing", addedCount: 0, removedCount: 0 }),
    { ...scannerEvent(), id: "legacy-forvia" },
    { ...scannerEvent(), id: "legacy-umicore" }
  ];

  const summary = policy.summarizeScannerEvents(events, "fuel-cell");
  assert.equal(summary.total, 3);
  assert.equal(summary.actionable, 0);
  assert.equal(summary.suppressed, 3);
  assert.equal(summary.categories.operational_baseline, 1);
  assert.equal(summary.categories.legacy_unverifiable, 2);
});

test("Review Desk gate suppresses only non-actionable AI scan cards", async () => {
  const gateSource = await fs.readFile(new URL("../review-queue-gate.js", import.meta.url), "utf8");
  const cards = [
    reviewCard("baseline", "AI scan", { status: "baseline_missing", addedCount: 0, removedCount: 0 }),
    reviewCard("legacy", "AI scan"),
    reviewCard("actionable", "AI scan", { status: "comparable", addedCount: 1, removedCount: 0 }),
    reviewCard("user", "User submission"),
    reviewCard("map", "Map candidate")
  ];

  const context = vm.createContext({
    ScannerEventPolicy: policy,
    buildReviewQueue: () => cards
  });
  vm.runInContext(gateSource, context);

  assert.deepEqual(
    Array.from(context.buildReviewQueue(), (item) => item.id),
    ["actionable", "user", "map"]
  );
});
