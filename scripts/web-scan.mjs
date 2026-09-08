import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watchlistPath = path.join(root, "data", "source-watchlist.json");
const cachePath = path.join(root, "data", "source-cache.json");
const outputPath = path.join(root, "data", "generated-update-events.json");
const WEEKLY_INTERVAL_MS = 6.5 * 24 * 60 * 60 * 1000;

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

function eventId(industryId, date, source) {
  const target = source.companyId || source.nodeId || source.id;
  return `web-${industryId}-${date}-${target}`;
}

function cadenceDue(cadence, previous, checkedAt) {
  if (cadence !== "weekly") return true;
  if (!previous?.lastCheckedAt) return true;

  const previousTime = Date.parse(previous.lastCheckedAt);
  const currentTime = Date.parse(checkedAt);
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return true;

  return currentTime - previousTime >= WEEKLY_INTERVAL_MS;
}

function buildAnalysis({ source, hits }) {
  const matchedKeywords = hits.length ? hits : [];
  const hasStrongMatch = matchedKeywords.length >= 2;
  const reviewPriority = source.sourceType === "company_official" && hasStrongMatch ? "high" : "medium";
  const affectedTarget = source.companyId ? `company:${source.companyId}` : `node:${source.nodeId}`;

  return {
    reviewPriority,
    matchedKeywords,
    affectedTarget,
    analystSummary: hasStrongMatch
      ? "The changed page matched multiple watched terms. Review whether the company role, bottleneck thesis, recent updates, or source evidence should change."
      : "The page changed, but keyword evidence is limited. Confirm whether the change is material before approving.",
    recommendedChecks: [
      "Open the source URL and identify the exact changed disclosure.",
      "Check whether the update affects a node, company role, bottleneck judgement, or recent catalyst.",
      "Approve only if the evidence is specific enough to update the official database."
    ],
    suggestedDatabaseAction: source.companyId
      ? `If material, append a reviewed recent update to companies.${source.companyId}.recentUpdates.`
      : `If material, update the summary or thesis for node ${source.nodeId}.`
  };
}

function eventFromSource({ industryId, source, title, hits, date, detectedAt }) {
  const impactType = impactByNode[source.nodeId] || "supply_chain_importance";
  const hitText = hits.length ? hits.join(", ") : source.watchFor.join(", ");

  return {
    id: eventId(industryId, date, source),
    sourceType: "ai_scan",
    status: "pending",
    industryId,
    companyId: source.companyId,
    nodeId: source.nodeId,
    impactType,
    summary: `${source.name} changed. The page title is "${title}" and the scan matched ${hitText}. Review whether the change affects the supply chain thesis.`,
    sourceUrl: source.url,
    sourceNote: "Candidate event generated after the web scanner detected a page-content fingerprint change. Human review is still required.",
    sourceIds: [source.id],
    submittedBy: "ai",
    reviewDecision: null,
    reviewedAt: null,
    detectedAt,
    lastSeenAt: detectedAt,
    confidence: hits.length ? "medium" : "low",
    evidenceLevel: evidenceBySourceType[source.sourceType] || "B",
    analysis: buildAnalysis({ source, hits }),
    proposedActions: [
      {
        target: source.companyId ? `companies.${source.companyId}.signals.recentCatalyst` : `nodes.${source.nodeId}.summary`,
        action: "review",
        reason: "The page changed. Review the evidence before updating recent catalysts, node descriptions, or scores."
      }
    ]
  };
}

function mergeEventStore(existingEvents, detectedEvents) {
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
      "User-Agent": "FinLAB supply-chain scanner/0.2"
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

  if (!cadenceDue(cadence, previous, checkedAt)) {
    return null;
  }

  try {
    const page = await fetchSource(source);
    const changed = !previous || previous.hash !== page.hash;
    const hits = keywordHits(page.text, source.watchFor || []);

    cache[source.id] = {
      id: source.id,
      industryId,
      cadence,
      url: source.url,
      title: page.title,
      hash: page.hash,
      lastCheckedAt: checkedAt,
      lastChangedAt: changed ? checkedAt : previous.lastChangedAt,
      lastError: null
    };

    if (!changed) return null;
    return eventFromSource({ industryId, source, title: page.title, hits, date, detectedAt: checkedAt });
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
      console.log(`Detected ${events.length} changed-source event(s); event store contains ${eventStore.length} total event(s).`);
    })
    .catch((error) => {
      console.error(error);
      globalThis.process.exitCode = 1;
    });
}
