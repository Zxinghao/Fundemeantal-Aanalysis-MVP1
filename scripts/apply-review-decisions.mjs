import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyApprovedPatch, validateResearchPacket } from "./research-model.mjs";
import { validateApprovedPacketAuthority } from "./analyst-review-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const industriesPath = path.join(root, "data", "industries.json");
const outputPath = path.join(root, "data", "industries.reviewed.json");
const generatedEventsPath = path.join(root, "data", "generated-update-events.json");
const reviewStatuses = new Set(["approved", "rejected", "needs_more_evidence"]);

function usage() { console.log("Usage: node scripts/apply-review-decisions.mjs <review-decisions.json>"); }
function normalizeImpact(impact) {
  const map = {
    "Supply chain importance": "supply_chain_importance",
    "Bottleneck judgement": "bottleneck_judgement",
    "Financial or order update": "financial_update",
    "New player or relationship": "relationship_change"
  };
  return map[impact] || impact || "supply_chain_importance";
}
function normalizedReviewStatus(status) { return reviewStatuses.has(status) ? status : null; }
function reviewTimestamp(reviewExport) { return reviewExport.exportedAt || new Date().toISOString(); }

function eventFromReview(item, exportedAt, patchResult) {
  return {
    id: `reviewed-${item.id}`,
    sourceType: "manual_research",
    status: "approved",
    industryId: item.industryId,
    companyId: item.companyId || null,
    nodeId: item.nodeId || null,
    impactType: normalizeImpact(item.impact),
    summary: item.summary,
    sourceUrl: item.source && item.source.startsWith("http") ? item.source : null,
    sourceNote: item.source,
    sourceIds: item.sourceIds || [],
    submittedBy: "review_export",
    reviewDecision: "approved",
    reviewedAt: exportedAt,
    originalEventId: item.id,
    origin: item.origin,
    analystReview: item.analystReview || null,
    researchPacket: item.researchPacket || null,
    patchApplied: patchResult?.applied || [],
    patchSkipped: patchResult?.skipped || []
  };
}

function appendRecentUpdate(industry, item) {
  const company = industry.companies.find((candidate) => candidate.id === item.companyId || candidate.name === item.company || candidate.id === item.company);
  if (!company) return;
  const note = `[Reviewed] ${item.summary}`;
  if (!company.recentUpdates.includes(note)) company.recentUpdates.unshift(note);
}

function updateExistingIndustryEvent(industry, item, reviewedAt, patchResult) {
  const existing = industry.updateEvents.find((event) => event.id === item.id);
  if (!existing) return false;
  existing.status = item.reviewStatus;
  existing.reviewDecision = item.reviewStatus;
  existing.reviewedAt = reviewedAt;
  if (item.analystReview) existing.analystReview = item.analystReview;
  if (item.researchPacket) existing.researchPacket = item.researchPacket;
  if (patchResult) {
    existing.patchApplied = patchResult.applied;
    existing.patchSkipped = patchResult.skipped;
  }
  return true;
}

function validateStructuredApproval(item) {
  const errors = [...validateApprovedPacketAuthority(item.researchPacket), ...validateResearchPacket(item.researchPacket)];
  if (errors.length) throw new Error(`Structured approval ${item.id} failed validation: ${errors.join(" ")}`);
}

export function applyReviews(industries, reviewExport) {
  const reviewedAt = reviewTimestamp(reviewExport);
  const reviewedItems = (reviewExport.reviewedItems || []).filter((item) => normalizedReviewStatus(item.reviewStatus));
  const strictHumanReview = reviewExport.schemaVersion === "2.0";
  const applied = [];

  for (const item of reviewedItems) {
    const industry = industries.find((candidate) => candidate.id === item.industryId);
    if (!industry) continue;
    let patchResult = null;

    if (item.reviewStatus === "approved" && item.researchPacket) {
      if (strictHumanReview) validateStructuredApproval(item);
      patchResult = applyApprovedPatch(industry, item.researchPacket);
      const operations = item.researchPacket.proposedPatch?.operations || [];
      if (strictHumanReview && item.researchPacket.proposedPatch?.executable && patchResult.applied.length !== operations.length) {
        throw new Error(`Structured approval ${item.id} failed atomic patch preflight; no reviewed data was accepted.`);
      }
    }

    const existingUpdated = updateExistingIndustryEvent(industry, item, reviewedAt, patchResult);
    if (item.reviewStatus === "approved") {
      if (!existingUpdated) {
        const newEvent = eventFromReview(item, reviewedAt, patchResult);
        const exists = industry.updateEvents.some((event) => event.id === newEvent.id || event.originalEventId === item.id);
        if (!exists) industry.updateEvents.unshift(newEvent);
      }
      if (!item.researchPacket) appendRecentUpdate(industry, item);
    }

    industry.lastReviewedAt = reviewedAt;
    applied.push(item.id);
  }
  return applied;
}

export function applyEventReviewStatuses(events, reviewExport) {
  const reviewedAt = reviewTimestamp(reviewExport);
  const reviewedItems = reviewExport.reviewedItems || [];
  const decisions = new Map(reviewedItems.map((item) => [item.id, normalizedReviewStatus(item.reviewStatus)]).filter(([, status]) => status));
  const packetById = new Map(reviewedItems.filter((item) => item.researchPacket).map((item) => [item.id, item.researchPacket]));
  const analystReviewById = new Map(reviewedItems.filter((item) => item.analystReview).map((item) => [item.id, item.analystReview]));
  const updatedIds = [];
  const nextEvents = (Array.isArray(events) ? events : []).map((event) => {
    const decision = decisions.get(event.id);
    if (!decision) return event;
    updatedIds.push(event.id);
    return {
      ...event,
      status: decision,
      reviewDecision: decision,
      reviewedAt,
      analystReview: analystReviewById.get(event.id) || event.analystReview || null,
      researchPacket: packetById.get(event.id) || event.researchPacket || null
    };
  });
  return { events: nextEvents, updatedIds };
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return fallback; }
}

async function main() {
  const reviewFile = globalThis.process.argv[2];
  if (!reviewFile) { usage(); globalThis.process.exitCode = 1; return; }
  const reviewPath = path.resolve(globalThis.process.cwd(), reviewFile);
  const industries = JSON.parse(await fs.readFile(industriesPath, "utf8"));
  const reviewExport = JSON.parse(await fs.readFile(reviewPath, "utf8"));
  const generatedEvents = await readJson(generatedEventsPath, []);
  const applied = applyReviews(industries, reviewExport);
  const eventReviewResult = applyEventReviewStatuses(generatedEvents, reviewExport);
  await fs.writeFile(outputPath, `${JSON.stringify(industries, null, 2)}\n`);
  await fs.writeFile(generatedEventsPath, `${JSON.stringify(eventReviewResult.events, null, 2)}\n`);
  console.log(`Applied ${applied.length} review decision(s) to ${outputPath}`);
  console.log(`Persisted ${eventReviewResult.updatedIds.length} scanner event status update(s) to ${generatedEventsPath}`);
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && fileURLToPath(import.meta.url) === path.resolve(cliEntry)) {
  main().catch((error) => { console.error(error); globalThis.process.exitCode = 1; });
}
