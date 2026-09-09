import test from "node:test";
import assert from "node:assert/strict";

import {
  assessSourceHealth,
  buildSourceHealthRows,
  sourceIsOverdue,
  summarizeSourceHealth
} from "../scripts/source-health-model.mjs";

const now = Date.parse("2026-09-10T12:00:00.000Z");

function source(overrides = {}) {
  return {
    id: "source-1",
    name: "Official source",
    industryId: "fuel-cell",
    cadence: "daily",
    sourceType: "company_official",
    url: "https://example.com/source",
    watchFor: ["capacity", "customer"],
    ...overrides
  };
}

test("a matching successful watched-context baseline is comparison-ready", () => {
  const result = assessSourceHealth(source(), {
    url: "https://example.com/source",
    hash: "hash-1",
    watchSnapshot: { segments: [{ hash: "segment-1" }] },
    baselineAt: "2026-09-09T06:00:00.000Z",
    lastCheckedAt: "2026-09-10T06:00:00.000Z",
    lastError: null
  }, now);

  assert.equal(result.status, "ready");
  assert.equal(result.baselineAt, "2026-09-09T06:00:00.000Z");
  assert.equal(result.watchSegmentCount, 1);
});

test("a current source error overrides a retained older baseline", () => {
  const result = assessSourceHealth(source(), {
    url: "https://example.com/source",
    hash: "old-hash",
    watchSnapshot: { segments: [{ hash: "old-segment" }] },
    lastCheckedAt: "2026-09-10T06:00:00.000Z",
    lastError: "HTTP 503"
  }, now);

  assert.equal(result.status, "error");
  assert.match(result.detail, /HTTP 503/);
});

test("a URL mismatch is baseline-pending rather than comparison-ready", () => {
  const result = assessSourceHealth(source(), {
    url: "https://example.com/old-source",
    hash: "old-hash",
    watchSnapshot: { segments: [{ hash: "old-segment" }] },
    lastCheckedAt: "2026-09-10T06:00:00.000Z",
    lastError: null
  }, now);

  assert.equal(result.status, "baseline_pending");
  assert.equal(result.baselineAt, null);
});

test("an unseen source is explicitly not checked", () => {
  const result = assessSourceHealth(source(), null, now);
  assert.equal(result.status, "not_checked");
  assert.equal(result.lastCheckedAt, null);
});

test("overdue thresholds distinguish daily and weekly cadence", () => {
  assert.equal(sourceIsOverdue("daily", "2026-09-08T00:00:00.000Z", now), true);
  assert.equal(sourceIsOverdue("daily", "2026-09-10T06:00:00.000Z", now), false);
  assert.equal(sourceIsOverdue("weekly", "2026-09-04T00:00:00.000Z", now), false);
  assert.equal(sourceIsOverdue("weekly", "2026-09-01T00:00:00.000Z", now), true);
});

test("industry health summary counts readiness without inventing events", () => {
  const watchlist = {
    "fuel-cell": {
      daily: [
        source({ id: "ready", name: "Ready source" }),
        source({ id: "error", name: "Broken source", url: "https://example.com/error" })
      ],
      weekly: [
        source({ id: "pending", name: "Pending source", cadence: "weekly", url: "https://example.com/pending" }),
        source({ id: "never", name: "Never checked", cadence: "weekly", url: "https://example.com/never" })
      ]
    },
    other: {
      daily: [source({ id: "other-source", industryId: "other" })],
      weekly: []
    }
  };
  const cache = {
    ready: {
      url: "https://example.com/source",
      hash: "hash",
      watchSnapshot: { segments: [] },
      lastCheckedAt: "2026-09-10T06:00:00.000Z",
      lastError: null
    },
    error: {
      url: "https://example.com/error",
      lastCheckedAt: "2026-09-10T06:00:00.000Z",
      lastError: "fetch failed"
    },
    pending: {
      url: "https://example.com/pending",
      hash: "hash-without-watch-snapshot",
      lastCheckedAt: "2026-09-09T06:00:00.000Z",
      lastError: null
    }
  };

  const rows = buildSourceHealthRows(watchlist, cache, "fuel-cell", now);
  const summary = summarizeSourceHealth(rows);

  assert.equal(rows.length, 4);
  assert.deepEqual(summary, {
    total: 4,
    ready: 1,
    baselinePending: 1,
    errors: 1,
    notChecked: 1,
    overdue: 0
  });
  assert.equal(rows[0].status, "error");
});
