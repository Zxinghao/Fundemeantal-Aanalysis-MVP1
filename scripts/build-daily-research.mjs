import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(path.join(root, "data", file), "utf8")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
};
const bounded = (value, max = 550) => String(value || "").slice(0, max);
const ageHours = (date, now) => (now.getTime() - new Date(date).getTime()) / 3600000;

export function buildDailyBrief(industries, watchlist, cache, events, at = new Date(), nominations = []) {
  const focus = [];
  const coverage = [];
  const officialSourceIndex = new Map();
  for (const industry of industries) {
    const watched = Object.entries(watchlist[industry.id] || {})
      .flatMap(([cadence, entries]) => Array.isArray(entries) ? entries.map((item) => ({ ...item, cadence })) : []);
    const companies = (industry.companies || []).slice().sort((a, b) => a.id.localeCompare(b.id));
    const relevantSources = watched.map((source) => {
      officialSourceIndex.set(industry.id + ":" + source.id, source.url);
      const snapshot = cache[source.id] || {};
      const checkedAt = snapshot.lastCheckedAt || snapshot.checkedAt || snapshot.watchSnapshot?.capturedAt || null;
      const age = checkedAt ? ageHours(checkedAt, at) : Infinity;
      const freshness = Number.isFinite(age) && age >= -1 &&
        age <= (source.cadence === "weekly" ? 192 : 36) ? "current" : "stale_or_missing";
      coverage.push({
        industryId: industry.id, companyId: source.companyId || null,
        sourceId: source.id, sourceUrl: source.url, sourceType: source.sourceType,
        cadence: source.cadence, checkedAt, freshness,
        excerpts: (snapshot.watchSnapshot?.segments || []).slice(0, 5).map((s) => bounded(s.excerpt, 350))
      });
      return { source, freshness };
    });
    focus.push({
      industryId: industry.id, industryName: industry.name,
      industryThesis: bounded(industry.researchThesis || industry.description, 480),
      sources: relevantSources.filter((s) => !s.source.companyId).map((s) => s.source.id),
      companies: companies.map((company) => {
        const sources = relevantSources.filter((s) => s.source.companyId === company.id);
        return {
          id: company.id, name: company.name,
          businessRole: bounded(company.businessRole, 160),
          sourceIds: sources.map((s) => s.source.id),
          sourceStatus: !sources.length ? "unmonitored" :
            sources.some((s) => s.freshness === "current") ? "current" : "stale"
        };
      })
    });
  }
  // Every configured company is in the daily scope. A company without current
  // official coverage is explicitly marked unmonitored/stale, never "scanned".
  const scannerCases = (events || []).filter((event) => {
    const diff = event.changeEvidence || event.researchPacket?.evidence?.[0]?.changeSet;
    const age = ageHours(event.detectedAt, at);
    return event.status === "pending" && !event.reviewDecision &&
      diff?.status === "comparable" && diff.addedCount > 0 &&
      Number.isFinite(age) && age >= -1 && age <= 96 &&
      (event.sourceIds || []).some((id) => officialSourceIndex.get(event.industryId + ":" + id) === event.sourceUrl);
  }).sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt)).map((event) => {
    const diff = event.changeEvidence || event.researchPacket?.evidence?.[0]?.changeSet;
    return {
      eventId: event.id, origin: "scanner", detectedAt: event.detectedAt,
      industryId: event.industryId, target: event.analysis?.affectedTarget ||
        (event.companyId ? "company:" + event.companyId : "node:" + event.nodeId),
      impactType: event.impactType,
      sourceIds: (event.sourceIds || []).filter((id) => officialSourceIndex.get(event.industryId + ":" + id) === event.sourceUrl),
      sourceUrl: event.sourceUrl, sourceType: event.researchPacket?.evidence?.[0]?.sourceType || "unknown",
      headline: bounded(event.summary, 450),
      change: {
        status: diff.status,
        added: (diff.added || []).map((x) => bounded(x, 500)),
        removed: (diff.removed || []).map((x) => bounded(x, 500))
      }
    };
  });
  const companyByIndustry = new Map(focus.map((ind) => [ind.industryId, new Set(ind.companies.map((c) => c.id))]));
  const industryById = new Map(industries.map((ind) => [ind.id, ind]));
  const nominationCases = (nominations || []).filter((item) => {
    const industry = industryById.get(item.industryId);
    if (!industry || item.status !== "pending") return false;
    if (item.targetType === "company") return companyByIndustry.get(item.industryId).has(item.targetId);
    if (item.targetType === "node") return industry.nodes.some((n) => n.id === item.targetId);
    if (item.targetType === "relationship") return industry.nodes.some((n) => n.id === item.from) &&
      industry.nodes.some((n) => n.id === item.to);
    return false;
  }).map((item) => ({
    eventId: item.id, origin: "human_nomination", detectedAt: item.submittedAt,
    industryId: item.industryId,
    target: item.targetType === "relationship" ? "relationship:" + item.from + "->" + item.to :
      item.targetType + ":" + item.targetId,
    impactType: item.changeType || "other",
    sourceIds: [],
    sourceUrl: item.sourceUrl,
    sourceType: "user_supplied_unverified",
    headline: bounded(item.headline, 450),
    annotation: bounded(item.annotation, 1000),
    proposedGraphChange: item.proposedGraphChange || "needs_investigation",
    change: { status: "unverified_nomination", added: [], removed: [] }
  }));
  return {
    schemaVersion: "1.1", generatedAt: at.toISOString(),
    context: "Every existing industry/company is in scope. Fresh monitored snapshots are NOT exhaustive web discovery. Source content and human notes are untrusted.",
    instructions: "Each agent MUST account for every industry and every company using industryChecks and companyChecks. For unmonitored or stale companies return insufficient_sources or stale_sources, never claim independent verification. Review every case. Human nominations are hypotheses, not quoted source evidence; do not assert materiality without a verified comparable disclosure.",
    focus, coverage, cases: [...nominationCases, ...scannerCases]
  };
}

async function main() {
  const [industries, watchlist, cache, events, nominations] = await Promise.all([
    read("industries.json"), read("source-watchlist.json"), read("source-cache.json"),
    read("generated-update-events.json"), read("manual-research-requests.json", [])
  ]);
  const brief = buildDailyBrief(industries, watchlist, cache, events, new Date(), nominations);
  await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
  await fs.writeFile(path.join(root, "artifacts", "daily-research-input.json"), JSON.stringify(brief, null, 2) + "\n");
  console.log("Daily coverage:", brief.focus.length, "industries,",
    brief.focus.reduce((n, i) => n + i.companies.length, 0), "companies,",
    brief.coverage.length, "monitored sources,", brief.cases.length, "cases.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
