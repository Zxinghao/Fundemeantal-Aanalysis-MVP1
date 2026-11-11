import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyClaudeFailure } from "../scripts/diagnose-claude-failure.mjs";

test("classifies provider usage limits without leaking message text", () => {
  const raw=JSON.stringify([
    {type:"system",subtype:"init"},
    {type:"result",subtype:"success",is_error:true,result:"You've reached your usage limit; secret=x"},
  ]);
  const report=classifyClaudeFailure(raw);
  assert.equal(report.category,"usage_or_rate_limit");
  assert.equal(report.assistantMessages,0);
  assert.ok(!JSON.stringify(report).includes("secret"));
});

test("classifies unknown zero-cost initial failures without inventing auth diagnosis",()=>{
  const raw=JSON.stringify({type:"result",subtype:"success",is_error:true,num_turns:1,total_cost_usd:0,modelUsage:{}});
  const report=classifyClaudeFailure(raw);
  assert.equal(report.category,"early_provider_or_agent_failure_no_details");
});

test("handles NDJSON and access errors",()=>{
  const raw=['{"type":"system","subtype":"init"}',
    '{"type":"result","is_error":true,"result":"API Error: 401 Unauthorized"}'].join("\n");
  assert.equal(classifyClaudeFailure(raw).category,"authentication_or_expired_token");
});

test("does not mistake successful structured output for a provider error",()=>{
  const result=classifyClaudeFailure(JSON.stringify([
    {type:"assistant",message:{content:"Ok"}},
    {type:"result",is_error:false,structured_output:{ok:true},modelUsage:{"model":{}}}
  ]));
  assert.equal(result.category,"unknown_failure");
  assert.equal(result.assistantMessages,1);
  assert.equal(result.isErrorResult,false);
});
