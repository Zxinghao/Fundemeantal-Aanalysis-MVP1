import test from "node:test";
import assert from "node:assert/strict";

import { cadenceDue, mergeEventStore } from "../scripts/web-scan.mjs";
import { applyEventReviewStatuses, applyReviews } from "../scripts/apply-review-decisions.mjs";

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
