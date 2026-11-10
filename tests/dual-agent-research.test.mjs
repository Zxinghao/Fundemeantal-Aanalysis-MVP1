import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDailyBrief } from "../scripts/build-daily-research.mjs";
import { parseAgentOutput, reconcile } from "../scripts/reconcile-dual-research.mjs";
import { notificationCandidates, telegramText, notifyTelegram } from "../scripts/telegram-dual-alerts.mjs";

const now = new Date("2026-11-11T09:00:00Z");
const diff = "On 11 November 2026 the supplier confirmed a new verified manufacturing capacity expansion.";
const raw = {
  id: "evt-1", status: "pending", reviewDecision: null,
  detectedAt: "2026-11-11T07:00:00Z", industryId: "ai-optics", companyId: "abc", impactType: "capacity_change",
  analysis: { affectedTarget: "company:abc" },
  sourceUrl: "https://official.example.com/report", sourceIds: ["official-abc"],
  changeEvidence: { status: "comparable", addedCount: 1, added: [diff], removed: ["Older factory information."] }
};
const brief = { focus: [], coverage: [], cases: [{
  eventId: "evt-1", industryId: "ai-optics", detectedAt: raw.detectedAt,
  target: "company:abc", impactType: "capacity_change", sourceIds: ["official-abc"],
  sourceUrl: raw.sourceUrl, change: { added: [diff], removed: ["Older factory information."] }
}] };
const assessment = {
  eventId: "evt-1", verdict: "material_candidate", target: "company:abc", changeType: "capacity_change",
  confidence: "medium", claim: "New manufacturing capacity disclosed, investigate before graph update.",
  rationale: "The watched disclosure mentions an expanded facility.",
  sourceId: "official-abc", sourceUrl: raw.sourceUrl,
  evidenceExcerpt: "supplier confirmed a new verified manufacturing capacity expansion"
};
const agent = (a = assessment) => ({ schemaVersion: "1.0", coverageSummary: "Monitored sources checked; unmonitored entities remain unverified.", assessments: [a] });

test("daily brief rotates industry companies and never treats old events as fresh", () => {
  const industries = [{ id: "ai-optics", name: "AI Optics", companies: [{ id: "abc", name: "ABC" }] }];
  const watch = { "ai-optics": { daily: [{ id: "official-abc", companyId: "abc", url: raw.sourceUrl, sourceType: "company_official" }] } };
  const cache = { "official-abc": { lastCheckedAt: "2026-11-11T08:00:00Z", watchSnapshot: { segments: [{ excerpt: "capacity" }] } } };
  const result = buildDailyBrief(industries, watch, cache, [raw], now);
  assert.equal(result.cases.length, 1);
  assert.equal(result.coverage[0].freshness, "current");
  assert.equal(result.focus[0].companies[0].id, "abc");
  const old = buildDailyBrief(industries, watch, cache, [{ ...raw, detectedAt: "2026-10-10T08:00:00Z" }], now);
  assert.equal(old.cases.length, 0);
});

test("both validated models create a candidate, never a graph change", () => {
  const result = reconcile(brief, agent(), agent(), {}, now);
  assert.equal(result.run.consensus, 1);
  assert.equal(result.findings[0].status, "consensus_candidate");
  assert.equal(result.findings[0].humanApprovalRequired, true);
  assert.equal(result.findings[0].graphChanged, false);
  assert.equal(notificationCandidates(result, { sent: [] }).length, 1);
});

test("disagreement is not consensus", () => {
  const other = agent({ ...assessment, verdict: "non_material", changeType: "none" });
  assert.equal(reconcile(brief, agent(), other, {}, now).findings[0].status, "needs_evidence");
});

test("mismatch or invented evidence fails closed", () => {
  for (const broken of [
    { ...assessment, evidenceExcerpt: "This nonexistent quote is claimed to be evidence of expanded production." },
    { ...assessment, sourceUrl: "https://attacker.example" },
    { ...assessment, target: "company:wrong" },
    { ...assessment, confidence: "low" }
  ]) {
    const result = reconcile(brief, agent(broken), agent(), {}, now);
    assert.equal(result.run.consensus, 0);
  }
});

test("model output must follow the common contract", () => {
  assert.throws(() => parseAgentOutput('{"assessments":[]}'), /schemaVersion/);
  assert.deepEqual(parseAgentOutput(JSON.stringify(agent())).assessments, [assessment]);
});

test("Telegram notification is deduplicated; dry run never sends", async () => {
  const result = reconcile(brief, agent(), agent(), {}, now);
  const state = { sent: [{ eventId: "evt-1", notifiedAt: now.toISOString() }] };
  assert.equal(notificationCandidates(result, state).length, 0);
  const dry = await notifyTelegram({ reviews: result, ledger: { sent: [] }, dryRun: true });
  assert.equal(dry.pending, 1);
  assert.equal(dry.sent.length, 0);
  assert.match(telegramText(result.findings[0]), /Research Desk/);
});
