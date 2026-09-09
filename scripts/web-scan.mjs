import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildResearchPacket, evidenceLevelForSourceType } from "./research-model.mjs";
import { buildChangeEvidence, buildWatchSnapshot } from "./disclosure-diff.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watchlistPath = path.join(root, "data", "source-watchlist.json");
const cachePath = path.join(root, "data", "source-cache.json");
const outputPath = path.join(root, "data", "generated-update-events.json");
const WEEKLY_INTERVAL_MS = 6.5 * 24 * 60 * 60 * 1000;
const CHANGE_SIGNATURE_LENGTH = 12;

const impactByNode = {
  catalyst: "technology_change",
  tank: "capacity_change",
  compressor: "technology_change",
  stack: "policy_change",
  gdl: "technology_change",
  optical: "technology_change",
  switching: "technology_change",
  "optical-modules": "technology_change",
  dsp: "technology_change",
  "silicon-photonics": "technology_change",
  laser: "technology_change",
  "external-light-source": "technology_change",
  "packaging-test": "capacity_change"
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "Untitled source page";
}

function keywordHits(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(String(keyword).toLowerCase()));
}

function legacyEventId(industryId, date, source) {
  return `web-${industryId}-${date}-${source.id}`;
}

function signaturePayload(changeEvidence) {
  return {
    status: changeEvidence?.status || "unknown",
    added: Array.isArray(changeEvidence?.added) ? changeEvidence.added : [],
    removed: Array.isArray(changeEvidence?.removed) ? changeEvidence.removed : [],
    currentRelevant: Array.isArray(changeEvidence?.currentRelevant) ? changeEvidence.currentRelevant : []
  };
}

export function changeSignature(changeEvidence) {
  return hash(JSON.stringify(signaturePayload(changeEvidence))).slice(0, CHANGE_SIGNATURE_LENGTH);
}

export function eventIdForChange(industryId, date, source, changeEvidence) {
  return `${legacyEventId(industryId, date, source)}-${changeSignature(changeEvidence)}`;
}

export function cadenceDue(cadence, previous, checkedAt, currentUrl = null) {
  if (currentUrl && previous?.url && previous.url !== currentUrl) return true;
  if (cadence !== "weekly") return true;
  if (previous?.lastError) return true;
  if (!previous?.lastCheckedAt) return true;

  const previousTime = Date.parse(previous.lastCheckedAt);
  const currentTime = Date.parse(checkedAt);
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return true;

  return currentTime - previousTime >= WEEKLY_INTERVAL_MS;
}

export function sourceBaselineIsComparable(previous, source) {
  return Boolean(previous?.hash) && previous?.url === source?.url;
}

function relevantChangeCount(changeEvidence) {
  return Number(changeEvidence?.addedCount || 0) + Number(changeEvidence?.removedCount || 0);
}

export function shouldCreateReviewEvent(changeEvidence) {
  if (changeEvidence?.status === "comparable") {
    return relevantChangeCount(changeEvidence) > 0;
  }

  if (changeEvidence?.status === "baseline_missing") {
    return Array.isArray(changeEvidence.currentRelevant) && changeEvidence.currentRelevant.length > 0;
  }

  return false;
}

function buildAnalysis({ source, hits, changeEvidence }) {
  const matchedKeywords = hits.length ? hits : [];
  const relevantChanges = relevantChangeCount(changeEvidence);
  const comparable = changeEvidence?.status === "comparable";
  const hasRelevantDiff = comparable && relevantChanges > 0;
  const reviewPriority = source.sourceType === "company_official" && hasRelevantDiff
    ? "high"
    : comparable && relevantChanges === 0
      ? "low"
      : "medium";
  const affectedTarget = source.companyId ? `company:${source.companyId}` : `node:${source.nodeId}`;

  return {
    reviewPriority,
    matchedKeywords,
    affectedTarget,
    changeEvidenceStatus: changeEvidence?.status || "unknown",
    analystSummary: hasRelevantDiff
      ? `The page changed and ${relevantChanges} keyword-focused context window(s) changed. Review the surfaced excerpts before forming a claim.`
      : comparable
        ? "The page changed, but watched contexts did not. Treat this as low-priority until the source shows a material disclosure."
        : "The page changed, but a comparable watched-context baseline is not available. Review the source manually and use the new snapshot as the next baseline.",
    recommendedChecks: [
      "Read the added and removed watched-context excerpts, then open the primary source for surrounding context.",
      "Separate the observed text change from the investment claim it may support.",
      "If a score changes, attach a dimension-specific scoreEvidence record with rationale, source IDs, evidence date, and provenance."
    ],
    suggestedDatabaseAction: source.companyId
      ? `Review companies.${source.companyId}; prepare an explicit evidence-backed patch only if the disclosure changes a supported field.`
      : `Review node ${source.nodeId}; prepare an explicit patch only if the disclosure changes the node thesis.`
  };
}

function changeSummary(source, title, changeEvidence) {
  if (changeEvidence?.status === "comparable") {
    const count = relevantChangeCount(changeEvidence);
    if (count > 0) {
      return `${source.name} changed. The scanner isolated ${changeEvidence.addedCount} added and ${changeEvidence.removedCount} removed keyword-focused context window(s) on "${title}". Review the excerpts before changing the supply-chain thesis.`;
    }
    return `${source.name} changed, but its keyword-focused context windows did not change on "${title}". The change may be unrelated page boilerplate or dynamic content.`;
  }

  return `${source.name} changed on "${title}", but the previous watched-context baseline is unavailable. Current relevant excerpts were captured for future comparison; manual review is required.`;
}

export function eventFromSource({
  industryId,
  source,
  title,
  hits,
  date,
  detectedAt,
  changeEvidence = null,
  eventIdOverride = null
}) {
  const id = eventIdOverride || legacyEventId(industryId, date, source);
  const impactType = impactByNode[source.nodeId] || "supply_chain_importance";
  const researchPacket = buildResearchPacket({
    eventId: id,
    source,
    title,
    hits,
    impactType,
    detectedAt,
    changeEvidence
  });

  return {
    id,
    sourceType: "ai_scan",
    status: "pending",
    industryId,
    companyId: source.companyId,
    nodeId: source.nodeId,
    impactType,
    summary: changeSummary(source, title, changeEvidence),
    sourceUrl: source.url,
    sourceNote: "Candidate event generated after the web scanner detected a page-content fingerprint change. Watched-context excerpts narrow the review target but do not prove semantic materiality.",
    sourceIds: [source.id],
    submittedBy: "ai",
    reviewDecision: null,
    reviewedAt: null,
    detectedAt,
    lastSeenAt: detectedAt,
    changeSignature: changeSignature(changeEvidence),
    confidence: researchPacket.claim.confidence,
    evidenceLevel: evidenceLevelForSourceType(source.sourceType),
    changeEvidence,
    analysis: buildAnalysis({ source, hits, changeEvidence }),
    researchPacket
  };
}

export function mergeEventStore(existingEvents, detectedEvents) {
  const byId = new Map(
    (Array.isArray(existingEvents) ? existingEvents : [])
      .filter((event) => event?.id)
      .map((event) => [event.id, event])
  );

  for (const event of detectedEvents) {
    const previous = byId.get(event.id);
    if (!previous) {
      byId.set(event.id, {
        ...event,
        firstDetectedAt: event.detectedAt || null
      });
      continue;
    }

    const preservedStatus = previous.status && previous.status !== "pending" ? previous.status : event.status;
    byId.set(event.id, {
      ...previous,
      ...event,
      status: preservedStatus,
      reviewDecision: previous.reviewDecision ?? event.reviewDecision,
      reviewedAt: previous.reviewedAt ?? event.reviewedAt,
      firstDetectedAt: previous.firstDetectedAt || previous.detectedAt || event.detectedAt || null,
      lastSeenAt: event.detectedAt || previous.lastSeenAt || null
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = Date.parse(a.detectedAt || a.firstDetectedAt || "1970-01-01");
    const bTime = Date.parse(b.detectedAt || b.firstDetectedAt || "1970-01-01");
    return bTime - aTime;
  });
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "FinLAB supply-chain scanner/0.5"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const text = normalizeHtml(html);
  return {
    title: extractTitle(html),
    text,
    hash: hash(text)
  };
}

async function scanSource({ industryId, cadence, source, cache, date }) {
  const checkedAt = new Date().toISOString();
  const previous = cache[source.id];

  if (!cadenceDue(cadence, previous, checkedAt, source.url)) {
    return null;
  }

  try {
    const page = await fetchSource(source);
    const comparableBaseline = sourceBaselineIsComparable(previous, source);
    const changed = comparableBaseline && previous.hash !== page.hash;
    const hits = keywordHits(page.text, source.watchFor || []);
    const watchSnapshot = buildWatchSnapshot(page.text, source.watchFor || [], checkedAt);
    const changeEvidence = buildChangeEvidence({
      previousSnapshot: comparableBaseline ? previous?.watchSnapshot : null,
      currentSnapshot: watchSnapshot,
      pageChanged: changed
    });

    cache[source.id] = {
      id: source.id,
      industryId,
      cadence,
      url: source.url,
      title: page.title,
      hash: page.hash,
      baselineAt: comparableBaseline ? previous?.baselineAt || checkedAt : checkedAt,
      watchSnapshot,
      lastCheckedAt: checkedAt,
      lastChangedAt: comparableBaseline
        ? (changed ? checkedAt : previous?.lastChangedAt || null)
        : null,
      lastError: null
    };

    // A first successful fetch, including the first fetch after a configured source
    // URL changes, establishes a fresh baseline. Content from two different URLs is
    // never treated as a disclosure diff.
    if (!comparableBaseline || !changed) return null;

    // Scanner v0.5 deliberately suppresses full-page changes that do not alter any
    // watched context. They remain visible in the cache fingerprint/history but no
    // longer consume analyst attention as Review Desk events.
    if (!shouldCreateReviewEvent(changeEvidence)) return null;

    const eventIdOverride = eventIdForChange(industryId, date, source, changeEvidence);
    return eventFromSource({
      industryId,
      source,
      title: page.title,
      hits,
      date,
      detectedAt: checkedAt,
      changeEvidence,
      eventIdOverride
    });
  } catch (error) {
    cache[source.id] = {
      ...(cache[source.id] || {}),
      id: source.id,
      industryId,
      cadence,
      url: source.url,
      lastCheckedAt: checkedAt,
      lastError: error.message
    };
    return null;
  }
}

export async function runWebScan(date = today()) {
  const watchlist = await readJson(watchlistPath, {});
  const cache = await readJson(cachePath, {});
  const existingEvents = await readJson(outputPath, []);
  const detectedEvents = [];

  for (const [industryId, cadenceMap] of Object.entries(watchlist)) {
    for (const cadence of ["daily", "weekly"]) {
      for (const source of cadenceMap[cadence] || []) {
        if (!source.url) continue;
        const event = await scanSource({ industryId, cadence, source, cache, date });
        if (event) detectedEvents.push(event);
      }
    }
  }

  const eventStore = mergeEventStore(existingEvents, detectedEvents);
  await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
  await fs.writeFile(outputPath, `${JSON.stringify(eventStore, null, 2)}\n`);
  return { events: detectedEvents, eventStore, cache };
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runWebScan(globalThis.process.argv[2])
    .then(({ events, eventStore }) => {
      console.log(`Detected ${events.length} review-worthy changed-source event(s); event store contains ${eventStore.length} total event(s).`);
    })
    .catch((error) => {
      console.error(error);
      globalThis.process.exitCode = 1;
    });
}
