import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedVerdicts = new Set(["material_candidate", "non_material", "insufficient_evidence"]);
const allowedChanges = new Set(["capacity_change", "supplier_change", "technology_change", "contract_change", "company_exit", "other", "none"]);
const allowedConfidence = new Set(["low", "medium", "high"]);

export function parseAgentOutput(text) {
  const trimmed = String(text || "").trim().replace(new RegExp("^" + String.fromCharCode(96).repeat(3) + "(?:json)?\\s*", "i"), "")
    .replace(new RegExp("\\s*" + String.fromCharCode(96).repeat(3) + "$"), "");
  const doc = JSON.parse(trimmed);
  if (doc?.schemaVersion !== "1.0" || !Array.isArray(doc.assessments) ||
      !Array.isArray(doc.companyChecks) || !Array.isArray(doc.industryChecks) ||
      typeof doc.coverageSummary !== "string") {
    throw new Error("Agent output must match schemaVersion 1.0 with assessments[] and coverageSummary.");
  }
  return doc;
}

function safeAssessment(raw, original) {
  if (!raw || !original || raw.eventId !== original.eventId) return null;
  if (!allowedVerdicts.has(raw.verdict) || !allowedChanges.has(raw.changeType) ||
      !allowedConfidence.has(raw.confidence) || raw.target !== original.target) return null;
  if (typeof raw.claim !== "string" || raw.claim.length > 650 ||
      typeof raw.rationale !== "string" || raw.rationale.length > 1100 ||
      typeof raw.evidenceExcerpt !== "string" || raw.evidenceExcerpt.length > 450 ||
      typeof raw.sourceId !== "string" || !original.sourceIds.includes(raw.sourceId)) return null;
  if (raw.sourceUrl !== original.sourceUrl) return null;
  const sourceTexts = [...original.change.added, ...original.change.removed];
  const verifiedQuote = raw.evidenceExcerpt.trim().length >= 20 &&
    sourceTexts.some((text) => text.includes(raw.evidenceExcerpt.trim()));
  if (raw.verdict === "material_candidate" && (!verifiedQuote || raw.confidence === "low" ||
     raw.changeType === "none" || !raw.claim.trim())) return null;
  return {
    eventId: original.eventId, verdict: raw.verdict, target: raw.target,
    changeType: raw.changeType, confidence: raw.confidence,
    claim: raw.claim.trim(), rationale: raw.rationale.trim(),
    evidenceExcerpt: raw.evidenceExcerpt.trim(), sourceId: raw.sourceId, sourceUrl: raw.sourceUrl
  };
}

export function validateFullCoverage(brief, output, agentName) {
  const industries = Array.isArray(brief?.focus) ? brief.focus : [];
  const checks = Array.isArray(output?.companyChecks) ? output.companyChecks : [];
  const sectorChecks = Array.isArray(output?.industryChecks) ? output.industryChecks : [];
  const expectedCompanies = new Map();
  for (const industry of industries) for (const company of industry.companies || []) {
    expectedCompanies.set(industry.industryId + ":" + company.id, company.sourceStatus);
  }
  const seenCompanies = new Set();
  for (const check of checks) {
    const key = check?.industryId + ":" + check?.companyId;
    if (!expectedCompanies.has(key) || seenCompanies.has(key)) throw new Error(agentName + ": extra/duplicate company check " + key);
    if (!["current_evidence_checked", "stale_sources", "unmonitored"].includes(check.result) ||
        typeof check.summary !== "string" || !check.summary.trim() || check.summary.length > 700) {
      throw new Error(agentName + ": invalid company check " + key);
    }
    const expected = expectedCompanies.get(key);
    if ((expected === "unmonitored" && check.result !== "unmonitored") ||
        (expected === "stale" && check.result === "current_evidence_checked")) {
      throw new Error(agentName + ": invented source coverage for " + key);
    }
    seenCompanies.add(key);
  }
  if (seenCompanies.size !== expectedCompanies.size) throw new Error(
    agentName + ": incomplete company coverage " + seenCompanies.size + "/" + expectedCompanies.size);
  const expectedIndustries = new Set(industries.map((ind) => ind.industryId));
  const seenIndustries = new Set();
  for (const check of sectorChecks) {
    if (!expectedIndustries.has(check?.industryId) || seenIndustries.has(check.industryId) ||
        !["current_evidence_checked", "stale_sources", "unmonitored"].includes(check.result) ||
        typeof check.summary !== "string" || !check.summary.trim() || check.summary.length > 700) {
      throw new Error(agentName + ": invalid industry check");
    }
    seenIndustries.add(check.industryId);
  }
  if (seenIndustries.size !== expectedIndustries.size) throw new Error(agentName + ": incomplete industry coverage");
  return true;
}

export function reconcile(brief, claude, codex, existing = {}, at = new Date()) {
  if (!Array.isArray(brief?.cases) || !Array.isArray(brief?.focus) || !Array.isArray(brief?.coverage)) {
    throw new Error("Invalid daily input.");
  }
  validateFullCoverage(brief, claude, "Claude");
  validateFullCoverage(brief, codex, "Codex");
  const byModel = [claude, codex].map((doc) => {
    const entries = new Map();
    for (const raw of doc.assessments) {
      if (raw?.eventId && !entries.has(raw.eventId)) entries.set(raw.eventId, raw);
    }
    return entries;
  });
  const previous = new Map((existing.findings || []).map((item) => [item.eventId, item]));
  const output = [];
  for (const original of brief.cases) {
    const first = safeAssessment(byModel[0].get(original.eventId), original);
    const second = safeAssessment(byModel[1].get(original.eventId), original);
    const bothValid = !!first && !!second;
    const agreeMaterial = bothValid &&
      first.verdict === "material_candidate" && second.verdict === "material_candidate" &&
      first.target === second.target && first.changeType === second.changeType &&
      first.sourceId === second.sourceId && first.sourceUrl === second.sourceUrl &&
      (first.evidenceExcerpt.includes(second.evidenceExcerpt) || second.evidenceExcerpt.includes(first.evidenceExcerpt));
    const status = agreeMaterial ? "consensus_candidate" :
      bothValid && first.verdict === "non_material" && second.verdict === "non_material"
        ? "non_material" : "needs_evidence";
    const record = {
      eventId: original.eventId, industryId: original.industryId,
      target: original.target, origin: original.origin || "scanner",
      annotation: original.origin === "human_nomination" ? original.annotation || "" : null,
      proposedGraphChange: original.proposedGraphChange || null,
      sourceUrl: original.sourceUrl,
      sourceId: original.sourceIds[0], detectedAt: original.detectedAt,
      status, changeType: agreeMaterial ? first.changeType : null,
      summary: agreeMaterial ? first.claim : (status === "non_material" ? "Both reviewers found no material graph change." : "Independent findings diverged or lacked sufficient evidence."),
      claude: first, codex: second,
      firstConsensusAt: status === "consensus_candidate" ? (previous.get(original.eventId)?.firstConsensusAt || at.toISOString()) : null,
      checkedAt: at.toISOString(),
      humanApprovalRequired: true,
      graphChanged: false
    };
    previous.set(original.eventId, record);
    output.push(record);
  }
  const history = [...previous.values()].sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt))).slice(0, 300);
  return {
    schemaVersion: "1.0", lastRunAt: at.toISOString(),
    coverage: brief.coverage.map((s) => ({ industryId: s.industryId, companyId: s.companyId, sourceId: s.sourceId, freshness: s.freshness })),
    companyCoverage: brief.focus.flatMap((industry) => (industry.companies || []).map((company) => {
      const key = (check) => check.industryId === industry.industryId && check.companyId === company.id;
      return { industryId: industry.industryId, companyId: company.id, name: company.name,
        sourceStatus: company.sourceStatus, claude: claude.companyChecks.find(key),
        codex: codex.companyChecks.find(key) };
    })),
    industryCoverage: brief.focus.map((industry) => ({ industryId: industry.industryId,
      name: industry.industryName,
      claude: claude.industryChecks.find((check) => check.industryId === industry.industryId),
      codex: codex.industryChecks.find((check) => check.industryId === industry.industryId) })),
    focus: brief.focus, claudeCoverageSummary: claude.coverageSummary.slice(0, 1200),
    codexCoverageSummary: codex.coverageSummary.slice(0, 1200),
    run: { candidates: output.length, consensus: output.filter((x) => x.status === "consensus_candidate").length,
      conflicts: output.filter((x) => x.status === "needs_evidence").length },
    findings: history
  };
}

async function main() {
  const files = [
    "artifacts/daily-research-input.json", "artifacts/claude-output.json", "artifacts/codex-output.json"
  ];
  const [briefText, claudeText, codexText] = await Promise.all(files.map((f) => fs.readFile(path.join(root, f), "utf8")));
  const readPrevious = async () => {
    try { return JSON.parse(await fs.readFile(path.join(root, "data/dual-agent-reviews.json"), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  };
  const result = reconcile(JSON.parse(briefText), parseAgentOutput(claudeText), parseAgentOutput(codexText), await readPrevious());
  await fs.writeFile(path.join(root, "data/dual-agent-reviews.json"), JSON.stringify(result, null, 2) + "\n");
  console.log("Independent review reconciled: " + result.run.consensus + " consensus candidates, " + result.run.conflicts + " disagreements, no database patches applied.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
