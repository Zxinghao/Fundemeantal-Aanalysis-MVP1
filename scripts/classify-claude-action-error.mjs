// Classifies a Claude Code Action failure without echoing credentials,
// model text, source documents or the raw SDK error to public Actions logs.
// This helper intentionally emits a small fixed vocabulary only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const labels = {
  AUTH: "OAuth / API authentication rejected (401). Check credential type, validity, and provider access.",
  FORBIDDEN: "Provider rejected access (403). Check model and account permissions.",
  RATE_LIMIT: "Provider rate or usage limit (429). Check account allowance or retry after it resets.",
  BILLING: "Insufficient credits or billing limit. Check provider account funding.",
  MODEL: "Requested model unavailable or invalid. Check model eligibility.",
  STRUCTURED: "Response/schema output problem; credentials may be valid but structured output failed.",
  UNKNOWN: "SDK reported an error but the private diagnostic file did not identify a known category.",
  NO_FILE: "Claude Action did not leave an SDK execution file. Check job initialization and action errors."
};
export function classifyClaudeMessage(value) {
  const error = String(value || "");
  if (/(\b401\b|unauthori[sz]ed|invalid oauth|invalid access token|authentication[_\s-]*failed|failed to authenticate)/i.test(error)) return "AUTH";
  if (/(\b403\b|permission denied|forbidden|not permitted|not authorized for (this )?model)/i.test(error)) return "FORBIDDEN";
  if (/(\b429\b|rate[_\s-]*limit|usage[_\s-]*limit|too many requests|overloaded_error)/i.test(error)) return "RATE_LIMIT";
  if (/(insufficient[_\s-]*(credits|funds|quota)|billing|credit balance|payment required)/i.test(error)) return "BILLING";
  if (/(model.*(not found|unavailable|invalid|does not exist)|not_found_error)/i.test(error)) return "MODEL";
  if (/(structured_output|json[_\s-]*schema|schema validation|tool use.*validation)/i.test(error)) return "STRUCTURED";
  return "UNKNOWN";
}
export function resultMessages(content) {
  const parsed = [];
  try {
    const whole = JSON.parse(content);
    if (Array.isArray(whole)) parsed.push(...whole);
    else if (whole && typeof whole === "object") parsed.push(whole);
  } catch {
    for (const line of String(content).split("\n")) {
      try { parsed.push(JSON.parse(line)); } catch { /* do not expose unparsed text */ }
    }
  }
  return parsed.filter((message) => message?.type === "result" && message?.is_error === true)
    .map((message) => String(message.result || message.error || ""));
}
export function summarizePrivateExecution(filePath) {
  if (!fs.existsSync(filePath)) return "NO_FILE";
  const messages = resultMessages(fs.readFileSync(filePath, "utf8"));
  return messages.length ? classifyClaudeMessage(messages.join("\n")) : "UNKNOWN";
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = path.join(process.env.RUNNER_TEMP || "/tmp", "claude-execution-output.json");
  const category = summarizePrivateExecution(file);
  // Never print the raw SDK result; GitHub logs may be public.
  console.log("Claude safe diagnostic category: " + category);
  console.log(labels[category]);
}
