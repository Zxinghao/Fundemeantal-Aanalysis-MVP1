import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const industriesPath = path.join(root, "data", "industries.json");
const outputPath = path.join(root, "data", "industries.reviewed.json");

function usage() {
  console.log("Usage: node scripts/apply-review-decisions.mjs <review-decisions.json>");
}

function normalizeImpact(impact) {
  const map = {
    供应链重要性: "supply_chain_importance",
    卡脖子判断: "bottleneck_judgement",
    "财报/订单动态": "financial_update",
    "新增玩家/关系": "relationship_change"
  };

  return map[impact] || impact || "supply_chain_importance";
}

function eventFromReview(item, exportedAt) {
  return {
    id: `reviewed-${item.id}`,
    sourceType: "manual_research",
    status: "approved",
    industryId: item.industryId,
    companyId: null,
    nodeId: null,
    impactType: normalizeImpact(item.impact),
    summary: item.summary,
    sourceUrl: item.source && item.source.startsWith("http") ? item.source : null,
    sourceNote: item.source,
    sourceIds: item.sourceIds || [],
    submittedBy: "review_export",
    reviewDecision: "approved",
    reviewedAt: exportedAt || new Date().toISOString(),
    originalEventId: item.id,
    origin: item.origin
  };
}

function appendRecentUpdate(industry, item) {
  const company = industry.companies.find((candidate) => candidate.name === item.company || candidate.id === item.company);
  if (!company) return;

  const note = `[已审核] ${item.summary}`;
  if (!company.recentUpdates.includes(note)) {
    company.recentUpdates.unshift(note);
  }
}

export function applyReviews(industries, reviewExport) {
  const approvedItems = (reviewExport.reviewedItems || []).filter((item) => item.reviewStatus === "approved");
  const applied = [];

  for (const item of approvedItems) {
    const industry = industries.find((candidate) => candidate.id === item.industryId);
    if (!industry) continue;

    const newEvent = eventFromReview(item, reviewExport.exportedAt);
    const exists = industry.updateEvents.some((event) => event.id === newEvent.id || event.originalEventId === item.id);
    if (!exists) {
      industry.updateEvents.unshift(newEvent);
    }

    appendRecentUpdate(industry, item);
    industry.lastReviewedAt = reviewExport.exportedAt || new Date().toISOString();
    applied.push(item.id);
  }

  return applied;
}

async function main() {
  const reviewFile = process.argv[2];
  if (!reviewFile) {
    usage();
    process.exitCode = 1;
    return;
  }

  const reviewPath = path.resolve(process.cwd(), reviewFile);
  const industries = JSON.parse(await fs.readFile(industriesPath, "utf8"));
  const reviewExport = JSON.parse(await fs.readFile(reviewPath, "utf8"));
  const applied = applyReviews(industries, reviewExport);

  await fs.writeFile(outputPath, `${JSON.stringify(industries, null, 2)}\n`);
  console.log(`Applied ${applied.length} approved review decisions to ${outputPath}`);
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && fileURLToPath(import.meta.url) === path.resolve(cliEntry)) {
  main().catch((error) => {
    console.error(error);
    globalThis.process.exitCode = 1;
  });
}
