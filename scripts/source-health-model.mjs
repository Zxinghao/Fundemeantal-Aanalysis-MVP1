const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_LIMIT_MS = {
  daily: 1.5 * DAY_MS,
  weekly: 8 * DAY_MS
};

const statusOrder = {
  error: 0,
  not_checked: 1,
  baseline_pending: 2,
  ready: 3
};

export const sourceHealthLabels = {
  ready: "Ready for comparison",
  baseline_pending: "Baseline pending",
  error: "Source error",
  not_checked: "Not checked"
};

export function flattenWatchlist(watchlist, industryId = null) {
  const rows = [];
  for (const [configuredIndustryId, cadenceMap] of Object.entries(watchlist || {})) {
    if (industryId && configuredIndustryId !== industryId) continue;
    for (const cadence of ["daily", "weekly"]) {
      for (const source of cadenceMap?.[cadence] || []) {
        if (!source?.id) continue;
        rows.push({
          ...source,
          industryId: configuredIndustryId,
          cadence
        });
      }
    }
  }
  return rows;
}

export function sourceIsOverdue(cadence, lastCheckedAt, now = Date.now()) {
  if (!lastCheckedAt) return false;
  const checkedAt = Date.parse(lastCheckedAt);
  const currentTime = typeof now === "number" ? now : Date.parse(now);
  const limit = OVERDUE_LIMIT_MS[cadence];
  if (!Number.isFinite(checkedAt) || !Number.isFinite(currentTime) || !Number.isFinite(limit)) return false;
  return currentTime - checkedAt > limit;
}

export function assessSourceHealth(source, cacheEntry = null, now = Date.now()) {
  const lastCheckedAt = cacheEntry?.lastCheckedAt || null;
  const urlMatches = Boolean(cacheEntry?.url) && cacheEntry.url === source.url;
  const baselineReady = Boolean(cacheEntry?.hash && cacheEntry?.watchSnapshot && urlMatches);
  let status;
  let detail;

  if (!lastCheckedAt) {
    status = "not_checked";
    detail = "No scanner check has been recorded for this source yet.";
  } else if (cacheEntry?.lastError) {
    status = "error";
    detail = `Last scan failed: ${cacheEntry.lastError}`;
  } else if (!urlMatches) {
    status = "baseline_pending";
    detail = "The configured URL differs from the cached source. A fresh baseline is required before comparison.";
  } else if (!baselineReady) {
    status = "baseline_pending";
    detail = "The source has been checked, but a watched-context baseline is not ready yet.";
  } else {
    status = "ready";
    detail = "The source has a current watched-context baseline and can produce a comparable diff on a future relevant change.";
  }

  return {
    id: source.id,
    name: source.name || source.id,
    industryId: source.industryId,
    cadence: source.cadence,
    sourceType: source.sourceType || "unknown",
    url: source.url || null,
    status,
    statusLabel: sourceHealthLabels[status],
    detail,
    lastCheckedAt,
    baselineAt: baselineReady ? cacheEntry.baselineAt || null : null,
    lastChangedAt: cacheEntry?.lastChangedAt || null,
    lastError: cacheEntry?.lastError || null,
    overdue: sourceIsOverdue(source.cadence, lastCheckedAt, now),
    watchKeywordCount: Array.isArray(source.watchFor) ? source.watchFor.length : 0,
    watchSegmentCount: Array.isArray(cacheEntry?.watchSnapshot?.segments)
      ? cacheEntry.watchSnapshot.segments.length
      : 0
  };
}

export function buildSourceHealthRows(watchlist, cache, industryId = null, now = Date.now()) {
  return flattenWatchlist(watchlist, industryId)
    .map((source) => assessSourceHealth(source, cache?.[source.id] || null, now))
    .sort((a, b) => {
      const statusDelta = statusOrder[a.status] - statusOrder[b.status];
      if (statusDelta !== 0) return statusDelta;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function summarizeSourceHealth(rows) {
  const summary = {
    total: 0,
    ready: 0,
    baselinePending: 0,
    errors: 0,
    notChecked: 0,
    overdue: 0
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    summary.total += 1;
    if (row.status === "ready") summary.ready += 1;
    if (row.status === "baseline_pending") summary.baselinePending += 1;
    if (row.status === "error") summary.errors += 1;
    if (row.status === "not_checked") summary.notChecked += 1;
    if (row.overdue) summary.overdue += 1;
  }

  return summary;
}
