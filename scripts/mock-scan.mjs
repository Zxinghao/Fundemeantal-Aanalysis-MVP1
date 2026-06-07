import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watchlistPath = path.join(root, "data", "source-watchlist.json");
const outputPath = path.join(root, "data", "generated-update-events.json");

const impactByNode = {
  catalyst: "technology_change",
  tank: "capacity_change",
  compressor: "technology_change",
  stack: "policy_change",
  gdl: "technology_change",
  optical: "technology_change"
};

const actionByImpact = {
  technology_change: "review",
  capacity_change: "review",
  policy_change: "review",
  financial_update: "append"
};

const evidenceBySourceType = {
  company_official: "A",
  government: "A",
  exchange_filing: "A",
  industry_media: "B",
  media: "B",
  placeholder: "C"
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function eventId(industryId, date, source, index) {
  const target = source.companyId || source.nodeId || source.id;
  return `ai-${industryId}-${date}-${target}-${String(index + 1).padStart(3, "0")}`;
}

function describeSource(source) {
  const keywords = source.watchFor.join(", ");
  if (source.sourceType === "government") {
    return `${source.name} may publish updates related to ${keywords}. Verify whether the update affects industry demand, technical targets, or key node assumptions.`;
  }
  if (source.sourceType === "placeholder") {
    return `${source.name} is a placeholder source for ${keywords}. Add authoritative English sources before using it as evidence.`;
  }
  return `${source.name} may publish information related to ${keywords}. Verify whether the update affects the related company or supply chain node.`;
}

function proposedActionsFor(source, impactType) {
  const targetRoot = source.companyId ? `companies.${source.companyId}` : `nodes.${source.nodeId}`;
  return [
    {
      target: source.companyId ? `${targetRoot}.signals.recentCatalyst` : `${targetRoot}.summary`,
      action: actionByImpact[impactType] || "review",
      reason: "If the candidate information is verified, update recent catalysts, node descriptions, or the research thesis."
    }
  ];
}

function eventFromSource(industryId, cadence, source, index, date) {
  const impactType = impactByNode[source.nodeId] || "supply_chain_importance";
  return {
    id: eventId(industryId, date, source, index),
    sourceType: "ai_scan",
    status: "pending",
    industryId,
    companyId: source.companyId,
    nodeId: source.nodeId,
    impactType,
    summary: describeSource(source),
    sourceUrl: source.url,
    sourceNote: `Mock scanner candidate generated from the ${cadence} English-priority watchlist. The real page body has not been read yet.`,
    sourceIds: [source.id],
    submittedBy: "ai",
    reviewDecision: null,
    reviewedAt: null,
    confidence: source.sourceType === "placeholder" ? "low" : "medium",
    evidenceLevel: evidenceBySourceType[source.sourceType] || "B",
    proposedActions: proposedActionsFor(source, impactType)
  };
}

async function main() {
  const scanDate = globalThis.process.argv[2] || today();
  const watchlist = JSON.parse(await fs.readFile(watchlistPath, "utf8"));
  const events = [];
  for (const [industryId, cadenceMap] of Object.entries(watchlist)) {
    for (const cadence of ["daily", "weekly"]) {
      const sources = cadenceMap[cadence] || [];
      sources.forEach((source, index) => {
        if (!source.url) return;
        events.push(eventFromSource(industryId, cadence, source, index, scanDate));
      });
    }
  }
  await fs.writeFile(outputPath, `${JSON.stringify(events, null, 2)}\n`);
  console.log(`Generated ${events.length} events at ${outputPath}`);
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && fileURLToPath(import.meta.url) === path.resolve(cliEntry)) {
  main().catch((error) => {
    console.error(error);
    globalThis.process.exitCode = 1;
  });
}
