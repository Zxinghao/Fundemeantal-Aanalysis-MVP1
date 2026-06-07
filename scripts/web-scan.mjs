import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const watchlistPath = path.join(root, "data", "source-watchlist.json");
const cachePath = path.join(root, "data", "source-cache.json");
const outputPath = path.join(root, "data", "generated-update-events.json");

const impactByNode = {
  catalyst: "technology_change",
  tank: "capacity_change",
  compressor: "technology_change",
  stack: "policy_change",
  gdl: "technology_change",
  optical: "technology_change"
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

function eventFromSource({ industryId, source, title, hits, date }) {
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
    confidence: hits.length ? "medium" : "low",
    evidenceLevel: evidenceBySourceType[source.sourceType] || "B",
    proposedActions: [
      {
        target: source.companyId ? `companies.${source.companyId}.signals.recentCatalyst` : `nodes.${source.nodeId}.summary`,
        action: "review",
        reason: "The page changed. Review the evidence before updating recent catalysts, node descriptions, or scores."
      }
    ]
  };
}

async function fetchSource(source) {
  const response = await fetch(source.url, { headers: { "User-Agent": "FinLAB supply-chain scanner/0.1" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const text = normalizeHtml(html);
  return { title: extractTitle(html), text, hash: hash(text) };
}

async function scanSource({ industryId, cadence, source, cache, date }) {
  const checkedAt = new Date().toISOString();
  try {
    const page = await fetchSource(source);
    const previous = cache[source.id];
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
    return eventFromSource({ industryId, source, title: page.title, hits, date });
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
  const events = [];
  for (const [industryId, cadenceMap] of Object.entries(watchlist)) {
    for (const cadence of ["daily", "weekly"]) {
      for (const source of cadenceMap[cadence] || []) {
        if (!source.url) continue;
        const event = await scanSource({ industryId, cadence, source, cache, date });
        if (event) events.push(event);
      }
    }
  }
  await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
  await fs.writeFile(outputPath, `${JSON.stringify(events, null, 2)}\n`);
  return { events, cache };
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runWebScan(globalThis.process.argv[2])
    .then(({ events }) => console.log(`Generated ${events.length} changed-source events at ${outputPath}`))
    .catch((error) => {
      console.error(error);
      globalThis.process.exitCode = 1;
    });
}
