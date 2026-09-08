import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSemanticCandidate } from "./candidate-interpretation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eventsPath = path.join(root, "data", "generated-update-events.json");
const watchlistPath = path.join(root, "data", "source-watchlist.json");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function watchSourceById(watchlist, industryId, sourceId) {
  const cadenceMap = watchlist?.[industryId] || {};
  return [...(cadenceMap.daily || []), ...(cadenceMap.weekly || [])]
    .find((source) => source.id === sourceId) || null;
}

function matchedKeywordsForEvent(event) {
  const evidence = event?.researchPacket?.evidence?.[0];
  if (Array.isArray(evidence?.matchedKeywords)) return evidence.matchedKeywords;
  if (Array.isArray(event?.analysis?.matchedKeywords)) return event.analysis.matchedKeywords;
  return [];
}

function changeEvidenceForEvent(event) {
  return event?.researchPacket?.evidence?.[0]?.changeSet || event?.changeEvidence || null;
}

function canEnrich(event) {
  const changeEvidence = changeEvidenceForEvent(event);
  if (event?.sourceType !== "ai_scan" || !event?.researchPacket || !changeEvidence) return false;
  return changeEvidence.status === "comparable" || changeEvidence.status === "baseline_missing";
}

export function enrichSemanticCandidates(events, watchlist) {
  let enriched = 0;
  const nextEvents = (Array.isArray(events) ? events : []).map((event) => {
    if (!canEnrich(event)) return event;

    const existing = event.researchPacket.semanticCandidate;
    if (existing && existing.status !== "candidate") return event;

    const sourceId = event.sourceIds?.[0] || event.researchPacket.evidence?.[0]?.sourceId;
    const watchedSource = watchSourceById(watchlist, event.industryId, sourceId) || {
      id: sourceId || event.id,
      companyId: event.companyId || null,
      nodeId: event.nodeId || null,
      sourceType: event.researchPacket.evidence?.[0]?.sourceType || "unknown"
    };

    const semanticCandidate = buildSemanticCandidate({
      source: watchedSource,
      hits: matchedKeywordsForEvent(event),
      impactType: event.impactType,
      changeEvidence: changeEvidenceForEvent(event),
      detectedAt: event.detectedAt || event.firstDetectedAt || null
    });

    enriched += 1;
    return {
      ...event,
      researchPacket: {
        ...event.researchPacket,
        semanticCandidate
      }
    };
  });

  return { events: nextEvents, enriched };
}

export async function runSemanticEnrichment() {
  const events = await readJson(eventsPath, []);
  const watchlist = await readJson(watchlistPath, {});
  const result = enrichSemanticCandidates(events, watchlist);
  await fs.writeFile(eventsPath, `${JSON.stringify(result.events, null, 2)}\n`);
  return result;
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runSemanticEnrichment()
    .then(({ enriched }) => console.log(`Enriched ${enriched} scanner event(s) with semantic candidates.`))
    .catch((error) => {
      console.error(error);
      globalThis.process.exitCode = 1;
    });
}
