import test from "node:test";
import assert from "node:assert/strict";

import { cadenceDue } from "../scripts/web-scan.mjs";

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

test("successful weekly sources still respect their normal cadence", () => {
  const previous = {
    lastCheckedAt: "2026-09-09T06:04:18.722Z",
    lastError: null
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
