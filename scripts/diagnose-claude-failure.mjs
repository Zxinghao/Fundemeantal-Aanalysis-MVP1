/**
 * Claude Code Action v1 may suppress the SDK result.error/result string when
 * show_full_output=false, producing the misleading "missing structured_output"
 * error. Only print a predefined diagnostic category, never raw messages,
 * tokens, source content, prompts, or model output.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const categories = [
  ["authentication_or_expired_token", /\b(?:401|unauthorized|invalid[_ -]?(?:api[_ -]?)?key|not authenticated|authentication failed|oauth token (?:expired|invalid)|login required|please run \/?login)\b/i],
  ["access_or_permissions", /\b(?:403|permission denied|not authorized|forbidden|access denied|organization not allowed)\b/i],
  ["billing_or_credits", /\b(?:402|billing|insufficient credits|credit balance|payment required)\b/i],
  ["usage_or_rate_limit", /\b(?:429|rate.?limit|usage.?limit|limit reached|exceeded your (?:usage|plan)|too many requests|weekly limit)\b/i],
  ["model_not_available", /\b(?:404|model not found|model .*does not exist|unknown model)\b/i],
  ["service_unavailable", /\b(?:500|502|503|504|overloaded|internal server error|service unavailable)\b/i],
  ["network_timeout", /\b(?:timed out|timeout|econnreset|enotfound|fetch failed|network error)\b/i],
  ["structured_output_failure", /\b(?:structured_output|json.schema|schema validation)\b/i]
];

export function classifyClaudeFailure(raw) {
  const messages = [];
  let assistantCount = 0;
  let isErrorResult = false;
  let assistantUsage = false;
  function consume(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const entry of obj) consume(entry); return; }
    if (obj.type === "assistant") assistantCount++;
    if (obj.type === "result") {
      isErrorResult ||= obj.is_error === true;
      if (typeof obj.result === "string") messages.push(obj.result.slice(0, 6000));
      if (typeof obj.error === "string") messages.push(obj.error.slice(0, 3000));
      if (obj.modelUsage && Object.keys(obj.modelUsage).length > 0) assistantUsage = true;
    }
    if (obj.type === "error") {
      if (typeof obj.message === "string") messages.push(obj.message.slice(0, 3000));
      if (typeof obj.error === "string") messages.push(obj.error.slice(0, 3000));
    }
  }
  try { consume(JSON.parse(raw)); }
  catch {
    for (const line of String(raw).split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { consume(JSON.parse(line)); } catch { /* skip non-JSON diagnostic text */ }
    }
  }
  const joined = messages.join("\n").slice(0, 12000);
  const category = categories.find(([,regex])=>regex.test(joined))?.[0] ||
    (isErrorResult && !assistantUsage && assistantCount === 0
      ? "early_provider_or_agent_failure_no_details"
      : "unknown_failure");
  return { category, isErrorResult, assistantMessages: assistantCount, usageReported: assistantUsage };
}

async function main() {
  const temp = process.env.RUNNER_TEMP;
  if (!temp) { console.log("CLAUDE_DIAGNOSTIC=runner_temp_unavailable"); return; }
  let raw;
  try {
    raw = await fs.readFile(path.join(temp, "claude-execution-output.json"), "utf8");
  } catch {
    console.log("CLAUDE_DIAGNOSTIC=execution_file_unavailable");
    return;
  }
  const result = classifyClaudeFailure(raw);
  console.log("CLAUDE_DIAGNOSTIC=" + result.category);
  console.log("CLAUDE_EXECUTION_SUMMARY=" + JSON.stringify({
    errorResult: result.isErrorResult,
    assistantMessages: result.assistantMessages,
    usageReported: result.usageReported
  }));
  console.log("Security: original model/provider messages are intentionally suppressed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.log("CLAUDE_DIAGNOSTIC=unavailable");
    process.exitCode = 0;
  });
}
