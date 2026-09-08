import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeCompositeScore, validateResearchPacket } from "./research-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scoreDimensions = [
  "supplyChainImportance",
  "scarcity",
  "pricingPower",
  "switchingCost",
  "validationBarrier",
  "marketUnderappreciation"
];
const reviewStatuses = new Set(["pending", "approved", "rejected", "needs_more_evidence"]);

async function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function collectWatchlistSourceIds(watchlist, industryId) {
  const entry = watchlist[industryId] || {};
  return new Set([
    ...(entry.daily || []).map((source) => source.id),
    ...(entry.weekly || []).map((source) => source.id)
  ]);
}

function validateRubric(rubric, errors) {
  if (!rubric?.version) errors.push("scoring rubric must have a version.");
  if (!rubric?.dimensions || typeof rubric.dimensions !== "object") {
    errors.push("scoring rubric must define dimensions.");
    return;
  }

  const rubricDimensions = Object.keys(rubric.dimensions);
  for (const dimension of scoreDimensions) {
    if (!rubricDimensions.includes(dimension)) errors.push(`scoring rubric missing dimension: ${dimension}`);
  }
  for (const dimension of rubricDimensions) {
    if (!scoreDimensions.includes(dimension)) errors.push(`scoring rubric has unknown dimension: ${dimension}`);
  }

  const weightTotal = Object.values(rubric.dimensions)
    .reduce((sum, config) => sum + (Number(config?.weight) || 0), 0);
  if (Math.abs(weightTotal - 1) > 0.000001) {
    errors.push(`scoring rubric weights must sum to 1; received ${weightTotal}.`);
  }

  for (const [dimension, config] of Object.entries(rubric.dimensions)) {
    if (!config.label || !config.question) errors.push(`scoring rubric dimension ${dimension} must have label and question.`);
    if (!Number.isFinite(config.weight) || config.weight <= 0 || config.weight > 1) {
      errors.push(`scoring rubric dimension ${dimension} has invalid weight.`);
    }
  }

  if (!Array.isArray(rubric.classifications) || rubric.classifications.length === 0) {
    errors.push("scoring rubric must define classifications.");
  }
}

function validatePacket(packet, prefix, errors) {
  if (!packet) return;
  for (const error of validateResearchPacket(packet)) {
    errors.push(`${prefix} ${error}`);
  }
}

function validateIndustry(industry, watchlist, rubric, errors) {
  const prefix = `industry:${industry.id || "unknown"}`;
  if (!industry.id || !industry.name) errors.push(`${prefix} must have id and name.`);
  if (!Array.isArray(industry.nodes) || industry.nodes.length === 0) errors.push(`${prefix} must have nodes.`);
  if (!Array.isArray(industry.relationships)) errors.push(`${prefix} relationships must be an array.`);
  if (!Array.isArray(industry.companies)) errors.push(`${prefix} companies must be an array.`);
  if (!Array.isArray(industry.sources)) errors.push(`${prefix} sources must be an array.`);
  if (!Array.isArray(industry.updateEvents)) errors.push(`${prefix} updateEvents must be an array.`);

  const nodes = Array.isArray(industry.nodes) ? industry.nodes : [];
  const companies = Array.isArray(industry.companies) ? industry.companies : [];
  const sources = Array.isArray(industry.sources) ? industry.sources : [];
  const relationships = Array.isArray(industry.relationships) ? industry.relationships : [];
  const updateEvents = Array.isArray(industry.updateEvents) ? industry.updateEvents : [];

  for (const duplicate of duplicateIds(nodes)) errors.push(`${prefix} duplicate node id: ${duplicate}`);
  for (const duplicate of duplicateIds(companies)) errors.push(`${prefix} duplicate company id: ${duplicate}`);
  for (const duplicate of duplicateIds(sources)) errors.push(`${prefix} duplicate source id: ${duplicate}`);
  for (const duplicate of duplicateIds(updateEvents)) errors.push(`${prefix} duplicate update event id: ${duplicate}`);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const companyIds = new Set(companies.map((company) => company.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const knownEvidenceSourceIds = new Set([...sourceIds, ...collectWatchlistSourceIds(watchlist, industry.id)]);

  for (const node of nodes) {
    if (!node.id || !node.title || !node.position) {
      errors.push(`${prefix} node ${node.id || "unknown"} is missing id, title, or position.`);
      continue;
    }
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      errors.push(`${prefix} node ${node.id} has invalid position.`);
    }
  }

  for (const relationship of relationships) {
    if (!nodeIds.has(relationship.from)) errors.push(`${prefix} relationship from missing node: ${relationship.from}`);
    if (!nodeIds.has(relationship.to)) errors.push(`${prefix} relationship to missing node: ${relationship.to}`);
    for (const sourceId of relationship.sourceIds || []) {
      if (!sourceIds.has(sourceId)) errors.push(`${prefix} relationship references unknown official source: ${sourceId}`);
    }
  }

  for (const company of companies) {
    if (!nodeIds.has(company.id)) errors.push(`${prefix} company ${company.id} has no matching company node.`);
    for (const nodeId of company.linkedNodeIds || []) {
      if (!nodeIds.has(nodeId)) errors.push(`${prefix} company ${company.id} links missing node: ${nodeId}`);
    }
    for (const sourceId of company.sourceIds || []) {
      if (!sourceIds.has(sourceId)) errors.push(`${prefix} company ${company.id} references unknown official source: ${sourceId}`);
    }
    for (const dimension of scoreDimensions) {
      const value = company.scores?.[dimension];
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        errors.push(`${prefix} company ${company.id} score ${dimension} must be between 0 and 100.`);
      }
    }
    const composite = computeCompositeScore(company.scores, rubric);
    if (!Number.isFinite(composite) || composite < 0 || composite > 100) {
      errors.push(`${prefix} company ${company.id} cannot produce a valid composite score.`);
    }
  }

  for (const event of updateEvents) {
    if (!event.id) errors.push(`${prefix} update event missing id.`);
    if (event.industryId && event.industryId !== industry.id) errors.push(`${prefix} event ${event.id} has mismatched industryId.`);
    if (event.companyId && !companyIds.has(event.companyId)) errors.push(`${prefix} event ${event.id} references unknown company: ${event.companyId}`);
    if (event.nodeId && !nodeIds.has(event.nodeId)) errors.push(`${prefix} event ${event.id} references unknown node: ${event.nodeId}`);
    if (event.status && !reviewStatuses.has(event.status)) errors.push(`${prefix} event ${event.id} has invalid status: ${event.status}`);
    for (const sourceId of event.sourceIds || []) {
      if (!knownEvidenceSourceIds.has(sourceId)) errors.push(`${prefix} event ${event.id} references unknown evidence source: ${sourceId}`);
    }
    validatePacket(event.researchPacket, `${prefix} event ${event.id}`, errors);
  }
}

function validateWatchlist(watchlist, industryById, errors) {
  const seenSourceIds = new Set();
  for (const [industryId, cadenceMap] of Object.entries(watchlist || {})) {
    const industry = industryById.get(industryId);
    if (!industry) {
      errors.push(`watchlist references unknown industry: ${industryId}`);
      continue;
    }

    const nodeIds = new Set((industry.nodes || []).map((node) => node.id));
    const companyIds = new Set((industry.companies || []).map((company) => company.id));
    for (const cadence of ["daily", "weekly"]) {
      for (const source of cadenceMap[cadence] || []) {
        if (!source.id || !source.url) errors.push(`watchlist ${industryId}/${cadence} source must have id and url.`);
        if (seenSourceIds.has(source.id)) errors.push(`watchlist duplicate source id: ${source.id}`);
        seenSourceIds.add(source.id);
        if (source.companyId && !companyIds.has(source.companyId)) errors.push(`watchlist ${source.id} references unknown company: ${source.companyId}`);
        if (source.nodeId && !nodeIds.has(source.nodeId)) errors.push(`watchlist ${source.id} references unknown node: ${source.nodeId}`);
      }
    }
  }
}

function validateGeneratedEvents(events, industryById, watchlist, errors) {
  for (const duplicate of duplicateIds(events)) errors.push(`generated event store duplicate id: ${duplicate}`);

  for (const event of events || []) {
    const industry = industryById.get(event.industryId);
    if (!industry) {
      errors.push(`generated event ${event.id} references unknown industry: ${event.industryId}`);
      continue;
    }

    const nodeIds = new Set((industry.nodes || []).map((node) => node.id));
    const companyIds = new Set((industry.companies || []).map((company) => company.id));
    const knownSourceIds = new Set([
      ...(industry.sources || []).map((source) => source.id),
      ...collectWatchlistSourceIds(watchlist, industry.id)
    ]);

    if (!reviewStatuses.has(event.status)) errors.push(`generated event ${event.id} has invalid status: ${event.status}`);
    if (event.companyId && !companyIds.has(event.companyId)) errors.push(`generated event ${event.id} references unknown company: ${event.companyId}`);
    if (event.nodeId && !nodeIds.has(event.nodeId)) errors.push(`generated event ${event.id} references unknown node: ${event.nodeId}`);
    for (const sourceId of event.sourceIds || []) {
      if (!knownSourceIds.has(sourceId)) errors.push(`generated event ${event.id} references unknown source: ${sourceId}`);
    }
    validatePacket(event.researchPacket, `generated event ${event.id}`, errors);
  }
}

async function main() {
  const [industries, watchlist, generatedEvents, rubric] = await Promise.all([
    readJson("data/industries.json"),
    readJson("data/source-watchlist.json"),
    readJson("data/generated-update-events.json"),
    readJson("data/scoring-rubric.json")
  ]);

  const errors = [];
  if (!Array.isArray(industries) || industries.length === 0) {
    errors.push("data/industries.json must be a non-empty array.");
  }

  validateRubric(rubric, errors);
  for (const duplicate of duplicateIds(industries)) errors.push(`duplicate industry id: ${duplicate}`);
  const industryById = new Map((industries || []).map((industry) => [industry.id, industry]));

  for (const industry of industries || []) validateIndustry(industry, watchlist, rubric, errors);
  validateWatchlist(watchlist, industryById, errors);
  validateGeneratedEvents(generatedEvents, industryById, watchlist, errors);

  if (errors.length) {
    console.error(`Data validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const companyCount = industries.reduce((sum, industry) => sum + (industry.companies || []).length, 0);
  const nodeCount = industries.reduce((sum, industry) => sum + (industry.nodes || []).length, 0);
  console.log(`Data validation passed: rubric v${rubric.version}, ${industries.length} industries, ${nodeCount} nodes, ${companyCount} companies, ${generatedEvents.length} scanner events.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
