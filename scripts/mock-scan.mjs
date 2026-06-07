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

function describeSource(source, cadence) {
  const keywords = source.watchFor.join("、");
  if (source.sourceType === "government") {
    return `${source.name} 若出现 ${keywords} 相关更新，需要核验是否影响行业需求、技术目标或关键环节判断。`;
  }

  if (source.sourceType === "placeholder") {
    return `${source.name} 尚未补充真实来源，当前仅作为 ${keywords} 相关监控占位。`;
  }

  return `${source.name} 若披露 ${keywords} 相关信息，需要核验是否影响对应公司或供应链环节的重要性判断。`;
}

function proposedActionsFor(source, impactType) {
  const targetRoot = source.companyId ? `companies.${source.companyId}` : `nodes.${source.nodeId}`;
  return [
    {
      target: source.companyId ? `${targetRoot}.signals.recentCatalyst` : `${targetRoot}.summary`,
      action: actionByImpact[impactType] || "review",
      reason: "若候选信息属实，可能需要更新近期动态、环节描述或研究判断。"
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
    summary: describeSource(source, cadence),
    sourceUrl: source.url,
    sourceNote: `模拟扫描器根据 ${cadence} 监控源生成的候选事件，尚未读取真实网页正文。`,
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
  const scanDate = process.argv[2] || today();
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
