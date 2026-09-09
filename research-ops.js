import {
  buildSourceHealthRows,
  summarizeSourceHealth
} from "./scripts/source-health-model.mjs";

const container = document.querySelector("#source-health");
const industrySelect = document.querySelector("#industry-select");

let watchlist = {};
let sourceCache = {};
let generatedEvents = [];

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function currentIndustryId() {
  return industrySelect?.value || Object.keys(watchlist)[0] || null;
}

function formatTimestamp(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summaryMetric(label, value, className = "") {
  const card = node("div", `source-health-metric ${className}`.trim());
  card.append(node("strong", "", String(value)), node("span", "", label));
  return card;
}

function readinessNote(summary) {
  if (summary.errors > 0) {
    return `${summary.errors} monitored source${summary.errors === 1 ? " has" : "s have"} a current scan error. Research coverage is incomplete until the failing source is recovered.`;
  }
  if (summary.baselinePending + summary.notChecked > 0) {
    const pending = summary.baselinePending + summary.notChecked;
    return `${pending} monitored source${pending === 1 ? " still needs" : "s still need"} a watched-context baseline before it can produce a comparable disclosure diff.`;
  }
  if (summary.total > 0) {
    return "All configured sources for this industry have current comparable baselines. This means the scanner is ready to detect a future watched-context change; it does not mean a material event exists now.";
  }
  return "No monitored sources are configured for this industry.";
}

function scannerQueueNote(industryId) {
  const policy = globalThis.ScannerEventPolicy;
  if (!policy?.summarizeScannerEvents) return "Scanner event actionability policy is unavailable.";

  const summary = policy.summarizeScannerEvents(generatedEvents, industryId);
  if (summary.total === 0) return "Scanner event store has no historical records for this industry yet.";

  return `Scanner queue: ${summary.actionable} actionable comparable event${summary.actionable === 1 ? "" : "s"}; ${summary.suppressed} historical/non-comparable record${summary.suppressed === 1 ? "" : "s"} preserved in the event store but suppressed from Review Desk.`;
}

function sourceRow(row) {
  const item = node("div", `source-health-row ${row.status}${row.overdue ? " overdue" : ""}`);

  const heading = node("div", "source-health-row-heading");
  const titleBlock = node("div");
  titleBlock.append(
    node("strong", "source-health-name", row.name),
    node("small", "source-health-meta", `${row.cadence} · ${row.sourceType}`)
  );
  const badge = node("span", `source-health-badge ${row.status}`, row.statusLabel);
  heading.append(titleBlock, badge);
  item.append(heading);

  const detail = node("p", "source-health-detail", row.detail);
  item.append(detail);

  const facts = node("div", "source-health-facts");
  facts.append(
    node("span", "", `Last check: ${formatTimestamp(row.lastCheckedAt)}`),
    node("span", "", `Baseline: ${formatTimestamp(row.baselineAt)}`),
    node("span", "", `Watch terms: ${row.watchKeywordCount}`),
    node("span", "", `Captured contexts: ${row.watchSegmentCount}`)
  );
  if (row.overdue) facts.append(node("span", "source-health-overdue", "Cadence overdue"));
  item.append(facts);

  if (row.url) {
    const link = node("a", "source-health-link", "Open source");
    link.href = row.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    item.append(link);
  }

  return item;
}

function render() {
  if (!container) return;
  const industryId = currentIndustryId();
  const rows = buildSourceHealthRows(watchlist, sourceCache, industryId, Date.now());
  const summary = summarizeSourceHealth(rows);

  container.replaceChildren();

  const metrics = node("div", "source-health-metrics");
  metrics.append(
    summaryMetric("Comparable-ready", `${summary.ready}/${summary.total}`, summary.ready === summary.total && summary.total ? "good" : ""),
    summaryMetric("Errors", summary.errors, summary.errors ? "bad" : ""),
    summaryMetric("Baseline pending", summary.baselinePending + summary.notChecked, summary.baselinePending + summary.notChecked ? "warn" : ""),
    summaryMetric("Overdue", summary.overdue, summary.overdue ? "warn" : "")
  );
  container.append(metrics);

  const note = node("p", "source-health-summary", readinessNote(summary));
  container.append(note);

  const queueNote = node("p", "source-health-summary", scannerQueueNote(industryId));
  container.append(queueNote);

  if (!rows.length) return;

  const details = node("details", "source-health-details");
  if (summary.errors > 0 || summary.baselinePending + summary.notChecked > 0) details.open = true;
  const summaryNode = node("summary", "", `Monitored sources · ${rows.length}`);
  const list = node("div", "source-health-list");
  rows.forEach((row) => list.append(sourceRow(row)));
  details.append(summaryNode, list);
  container.append(details);
}

async function bootResearchOperations() {
  if (!container) return;
  container.textContent = "Loading source health…";
  [watchlist, sourceCache, generatedEvents] = await Promise.all([
    fetchJson("data/source-watchlist.json", {}),
    fetchJson("data/source-cache.json", {}),
    fetchJson("data/generated-update-events.json", [])
  ]);
  render();

  industrySelect?.addEventListener("change", render);
  if (industrySelect) {
    new MutationObserver(render).observe(industrySelect, { childList: true });
  }
}

bootResearchOperations();
