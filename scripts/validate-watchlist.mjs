import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const industriesPath = path.join(root, "data", "industries.json");
const watchlistPath = path.join(root, "data", "source-watchlist.json");
const allowedCadences = ["daily", "weekly"];
const allowedSourceTypes = new Set([
  "company_official",
  "government",
  "exchange_filing",
  "industry_media",
  "media",
  "placeholder"
]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function validateWatchlist(industries, watchlist) {
  const errors = [];
  const industryById = new Map((Array.isArray(industries) ? industries : []).map((industry) => [industry.id, industry]));
  const globallySeenIds = new Map();
  const seenIndustryUrls = new Map();

  if (!watchlist || typeof watchlist !== "object" || Array.isArray(watchlist)) {
    return ["source-watchlist.json must contain an object keyed by industry ID."];
  }

  for (const [industryId, cadenceMap] of Object.entries(watchlist)) {
    const industry = industryById.get(industryId);
    if (!industry) {
      errors.push(`Watchlist references unknown industry: ${industryId}.`);
      continue;
    }

    if (!nonEmpty(cadenceMap?.sourceLanguagePolicy)) {
      errors.push(`${industryId} must define sourceLanguagePolicy.`);
    }

    const companyIds = new Set((industry.companies || []).map((company) => company.id));
    const nodeIds = new Set((industry.nodes || []).map((node) => node.id));
    const canonicalSources = new Map((industry.sources || []).map((source) => [source.id, source]));

    for (const cadence of allowedCadences) {
      const sources = cadenceMap?.[cadence];
      if (!Array.isArray(sources)) {
        errors.push(`${industryId}.${cadence} must be an array.`);
        continue;
      }

      for (const source of sources) {
        const prefix = `${industryId}.${cadence}.${source?.id || "<missing-id>"}`;
        if (!nonEmpty(source?.id)) {
          errors.push(`${prefix}: source id is required.`);
          continue;
        }

        const previousIndustry = globallySeenIds.get(source.id);
        if (previousIndustry) {
          errors.push(`${prefix}: source id ${source.id} is already used by ${previousIndustry}; cache keys must be globally unique.`);
        } else {
          globallySeenIds.set(source.id, industryId);
        }

        if (!nonEmpty(source.name)) errors.push(`${prefix}: name is required.`);
        if (!allowedSourceTypes.has(source.sourceType)) errors.push(`${prefix}: invalid sourceType ${source.sourceType}.`);
        if (!nonEmpty(source.language)) errors.push(`${prefix}: language is required.`);

        const normalizedUrl = normalizeUrl(source.url);
        if (!normalizedUrl) {
          errors.push(`${prefix}: url must be a valid http(s) URL.`);
        } else {
          const urlKey = `${industryId}:${normalizedUrl}`;
          const previousId = seenIndustryUrls.get(urlKey);
          if (previousId) {
            errors.push(`${prefix}: URL duplicates ${previousId} inside ${industryId}.`);
          } else {
            seenIndustryUrls.set(urlKey, source.id);
          }
        }

        if (!Array.isArray(source.watchFor) || source.watchFor.length === 0 || source.watchFor.some((term) => !nonEmpty(term))) {
          errors.push(`${prefix}: watchFor must contain at least one non-empty term.`);
        }

        if (source.companyId != null && !companyIds.has(source.companyId)) {
          errors.push(`${prefix}: unknown companyId ${source.companyId}.`);
        }
        if (!nonEmpty(source.nodeId) || !nodeIds.has(source.nodeId)) {
          errors.push(`${prefix}: unknown or missing nodeId ${source.nodeId}.`);
        }

        const canonical = canonicalSources.get(source.id);
        if (canonical) {
          const canonicalUrl = normalizeUrl(canonical.url);
          if (canonicalUrl && normalizedUrl && canonicalUrl !== normalizedUrl) {
            errors.push(`${prefix}: URL differs from canonical industry source ${source.id}.`);
          }
          if (canonical.type && canonical.type !== source.sourceType) {
            errors.push(`${prefix}: sourceType differs from canonical industry source ${source.id}.`);
          }
        }
      }
    }
  }

  return errors;
}

export async function runWatchlistValidation() {
  const industries = JSON.parse(await fs.readFile(industriesPath, "utf8"));
  const watchlist = JSON.parse(await fs.readFile(watchlistPath, "utf8"));
  const errors = validateWatchlist(industries, watchlist);
  if (errors.length) {
    throw new Error(`Watchlist validation failed:\n- ${errors.join("\n- ")}`);
  }
  return {
    industryCount: Object.keys(watchlist).length,
    sourceCount: Object.values(watchlist).reduce((count, cadenceMap) => {
      return count + allowedCadences.reduce((subtotal, cadence) => subtotal + (cadenceMap?.[cadence]?.length || 0), 0);
    }, 0)
  };
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runWatchlistValidation()
    .then(({ industryCount, sourceCount }) => {
      console.log(`Watchlist validation passed for ${sourceCount} source(s) across ${industryCount} industry/industries.`);
    })
    .catch((error) => {
      console.error(error.message);
      globalThis.process.exitCode = 1;
    });
}
