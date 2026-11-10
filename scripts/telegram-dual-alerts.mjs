import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewsPath = path.join(root, "data/dual-agent-reviews.json");
const ledgerPath = path.join(root, "data/telegram-notification-state.json");

export function notificationCandidates(reviews, ledger) {
  const sent = new Set((ledger?.sent || []).map((item) => item.eventId));
  return (reviews?.findings || []).filter((item) =>
    item.status === "consensus_candidate" && item.humanApprovalRequired === true &&
    item.graphChanged === false && item.claude?.verdict === "material_candidate" &&
    item.codex?.verdict === "material_candidate" && !sent.has(item.eventId)
  );
}

export function telegramText(item, publicUrl) {
  const base = String(publicUrl || "https://zxinghao.github.io/Fundemeantal-Aanalysis-MVP1/").replace(/[?#].*$/, "");
  const url = base + "?event=" + encodeURIComponent(item.eventId) + "#desk";
  return [
    "🔎 供应链研究：双 Agent 共识候选",
    "行业：" + item.industryId,
    "节点：" + item.target,
    "类型：" + item.changeType,
    "初步结论：" + String(item.summary).slice(0, 360),
    "状态：尚未核实／尚未批准／产业链未变动",
    "来源：" + item.sourceUrl,
    "打开 Research Desk 查看两份意见及原始证据：",
    url
  ].join("\n");
}

async function readLedger() {
  try { return JSON.parse(await fs.readFile(ledgerPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { schemaVersion: "1.0", sent: [] }; throw error; }
}
export async function notifyTelegram({ reviews, ledger, token, chatId, fetchImpl = fetch, publicUrl, dryRun = false }) {
  const eligible = notificationCandidates(reviews, ledger);
  const result = { sent: [], failed: [], pending: eligible.length, ledger: { schemaVersion: "1.0", sent: [...(ledger.sent || [])] } };
  if (!dryRun && (!token || !chatId)) throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured in GitHub Actions Secrets.");
  for (const item of eligible) {
    if (dryRun) continue;
    try {
      const response = await fetchImpl("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: telegramText(item, publicUrl), disable_web_page_preview: true })
      });
      if (!response.ok) throw new Error("Telegram HTTP " + response.status);
      const body = await response.json();
      if (body.ok !== true) throw new Error("Telegram rejected sendMessage");
      result.ledger.sent.push({ eventId: item.eventId, notifiedAt: new Date().toISOString(), messageId: body.result?.message_id || null });
      result.sent.push(item.eventId);
    } catch (error) {
      // Never include the credential or request URL in logs.
      result.failed.push({ eventId: item.eventId, error: String(error.message).slice(0, 130) });
    }
  }
  result.ledger.sent = result.ledger.sent.slice(-600);
  return result;
}

async function main() {
  const [reviews, ledger] = await Promise.all([
    fs.readFile(reviewsPath, "utf8").then(JSON.parse), readLedger()
  ]);
  const dryRun = process.argv.includes("--dry-run");
  const result = await notifyTelegram({
    reviews, ledger, token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID, publicUrl: process.env.REVIEW_PUBLIC_URL,
    dryRun
  });
  if (!dryRun) await fs.writeFile(ledgerPath, JSON.stringify(result.ledger, null, 2) + "\n");
  console.log("Telegram queue: " + result.pending + " candidates; " + result.sent.length + " sent; " + result.failed.length + " delivery failures.");
  for (const item of result.failed) console.warn(item.eventId + ": " + item.error);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error("Notification step failed:", error.message); process.exitCode = 1; });
}
