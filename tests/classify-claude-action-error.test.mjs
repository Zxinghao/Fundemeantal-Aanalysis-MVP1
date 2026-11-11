import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyClaudeMessage, resultMessages } from "../scripts/classify-claude-action-error.mjs";

test("diagnose missing OAuth credentials without printing them", () => {
  assert.equal(classifyClaudeMessage("API Error: 401 OAuth access token is invalid"), "AUTH");
  assert.equal(classifyClaudeMessage("429 rate_limit_error"), "RATE_LIMIT");
  assert.equal(classifyClaudeMessage("billing error: insufficient credits"), "BILLING");
  assert.equal(classifyClaudeMessage("404 model not found"), "MODEL");
  assert.equal(classifyClaudeMessage("structured_output is missing"), "STRUCTURED");
});
test("parse SDK output array or NDJSON, ignoring prompts and noise", () => {
  const one={type:"result",subtype:"success",is_error:true,result:"API Error: 401"};
  const another={type:"assistant",message:{content:"secret"}};
  assert.deepEqual(resultMessages(JSON.stringify([another,one])),["API Error: 401"]);
  assert.deepEqual(resultMessages(JSON.stringify(another)+"\n"+JSON.stringify(one)),["API Error: 401"]);
});
