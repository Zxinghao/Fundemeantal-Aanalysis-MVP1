import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("the Telegram send ledger exists on a clean checkout and begins empty", () => {
  const filename=path.resolve("data/telegram-notification-state.json");
  assert.equal(fs.existsSync(filename),true,"required by the report git-auto-commit file_pattern");
  const ledger=JSON.parse(fs.readFileSync(filename,"utf8"));
  assert.equal(ledger.schemaVersion,"1.0");
  assert.ok(Array.isArray(ledger.sent));
});
