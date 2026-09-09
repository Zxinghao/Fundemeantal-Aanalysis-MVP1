import test from "node:test";
import assert from "node:assert/strict";

import { cadenceDue, sourceBaselineIsComparable } from "../scripts/web-scan.mjs";

function readySnapshot() {
  return {
    version: "1.0",
    capturedAt: "2026-09-09T06:04:18.722Z",
    keywords: ["hydrogen"],
    segments: []
  };
}

test("failed weekly sources retry on the next scan instead of waiting a week", () => {
  const previous = {
    lastCheckedAt: "2026-09-09T06:04:18.722Z",
    lastError: "HTTP 404"
  };

  assert.equal(
    cadenceDue("weekly", previous, "2026-09-09T06:30:00.000Z"),
    true
  );
});

test("successful weekly sources with a watched-context baseline respect normal cadence", () => {
  const previous = {
    lastCheckedAt: "2026-09-09T06:04:18.722Z",
    lastError: null,
    watchSnapshot: readySnapshot()
  };

  assert.equal(
    cadenceDue("weekly", previous, "2026-09-10T06:04:18.722Z"),
    false
  );
  assert.equal(
    cadenceDue("weekly", previous, "2026-09-16T06:04:18.722Z"),
    true
  );
});

test("legacy weekly cache without watched-context baseline is due immediately", () => {
  const previous = {
    url: "https://example.com/source",
    hash: "legacy-full-page-hash",
    lastCheckedAt: "2026-09-09T06:04:18.722Z",
    lastError: null
  };

  assert.equal(
    cadenceDue("weekly", previous, "2026-09-09T06:30:00.000Z", "https://example.com/source"),
    true
  );
});

test("a configured source URL change is due immediately even when weekly cadence is not", () => {
  const previous = {
    url: "https://example.com/old-source",
    lastCheckedAt: "2026-09-09T06:04:18.722Z",
    lastError: null,
    hash: "old-hash",
    watchSnapshot: readySnapshot()
  };

  assert.equal(
    cadenceDue(
      "weekly",
      previous,
      "2026-09-09T06:30:00.000Z",
      "https://example.com/new-source"
    ),
    true
  );
});

test("comparable baseline requires matching URL, hash, and watched-context snapshot", () => {
  const readyPrevious = {
    url: "https://example.com/source",
    hash: "old-hash",
    watchSnapshot: readySnapshot()
  };

  assert.equal(
    sourceBaselineIsComparable(readyPrevious, { url: "https://example.com/source" }),
    true
  );
  assert.equal(
    sourceBaselineIsComparable(readyPrevious, { url: "https://example.com/new-source" }),
    false
  );
  assert.equal(
    sourceBaselineIsComparable({ url: "https://example.com/source", hash: "old-hash" }, { url: "https://example.com/source" }),
    false
  );
});
