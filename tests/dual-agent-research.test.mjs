import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDailyBrief } from "../scripts/build-daily-research.mjs";
import { parseAgentOutput, reconcile, validateFullCoverage } from "../scripts/reconcile-dual-research.mjs";
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
const agent = (a = assessment) => ({ schemaVersion: "1.0", coverageSummary: "Monitored sources checked; unmonitored entities remain unverified.", assessments: [a], industryChecks: [], companyChecks: [] });

test("daily brief covers all registered companies and never treats old events as fresh", () => {
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


test("all existing companies are included daily, with explicit missing-coverage status", () => {
  const companies = Array.from({ length: 8 }, (_, n) => ({ id: "co" + n, name: "Company " + n }));
  const data = [{ id: "sector", name: "Sector", companies, nodes: [] }];
  const watch = { sector: { daily: [{ id: "source-co0", companyId: "co0", url: "https://company.example", sourceType: "company_official" }] } };
  const cache = { "source-co0": { lastCheckedAt: now.toISOString(), watchSnapshot: { segments: [] } } };
  const result = buildDailyBrief(data, watch, cache, [], now);
  assert.equal(result.focus[0].companies.length, 8);
  assert.equal(result.focus[0].companies[0].sourceStatus, "current");
  assert.equal(result.focus[0].companies[7].sourceStatus, "unmonitored");
  const checks = result.focus[0].companies.map((company) => ({
    industryId: "sector", companyId: company.id,
    result: company.sourceStatus === "current" ? "current_evidence_checked" : "unmonitored",
    summary: "Reviewed the available primary source coverage."
  }));
  const output = { companyChecks: checks, industryChecks: [{ industryId: "sector", result: "current_evidence_checked", summary: "Monitored sources checked." }] };
  assert.equal(validateFullCoverage(result, output, "TestAgent"), true);
  assert.throws(() => validateFullCoverage(result, { ...output, companyChecks: checks.slice(0, 4) }, "TestAgent"), /incomplete company coverage/);
  assert.throws(() => validateFullCoverage(result, { ...output, companyChecks: checks.map((x) => ({ ...x, result: "current_evidence_checked" })) }, "TestAgent"), /invented source coverage/);
});

test("human nomination enters both analyses but cannot become verified evidence automatically", () => {
  const industries = [{ id: "ai-optics", name: "AI optics", companies: [{ id: "abc", name: "ABC" }],
    nodes: [{ id: "laser" }, { id: "packaging" }] }];
  const nominations = [{
    id: "nomination-issue-23", submittedAt: now.toISOString(), status: "pending",
    industryId: "ai-optics", targetType: "relationship", from: "laser", to: "packaging",
    proposedGraphChange: "add_relationship", headline: "Possible connection",
    annotation: "Please inspect whether this upstream supply relationship exists.",
    sourceUrl: "https://official.example.com/report"
  }];
  const generated = buildDailyBrief(industries, {}, {}, [], now, nominations);
  assert.equal(generated.cases.length, 1);
  assert.equal(generated.cases[0].target, "relationship:laser->packaging");
  assert.deepEqual(generated.cases[0].change.added, []);
  const noSourceCase = { ...generated, focus: [], coverage: [] };
  const claimedMaterial = { ...assessment, eventId: "nomination-issue-23", target: "relationship:laser->packaging",
    sourceId: "", changeType: "supplier_change" };
  const out = { ...agent(claimedMaterial), industryChecks: [], companyChecks: [] };
  const report = reconcile(noSourceCase, out, out, {}, now);
  assert.equal(report.run.consensus, 0);
  assert.equal(report.findings[0].graphChanged, false);
});
