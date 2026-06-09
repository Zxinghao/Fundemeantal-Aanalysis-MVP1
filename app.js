let industries = [];

const supplementalIndustryFiles = [
  "data/industries/ai-optics.json"
];

const defaultPendingUpdates = [
  {
    company: "Johnson Matthey",
    impact: "bottleneck_judgement",
    source: "Official materials / investor materials",
    summary: "Verify whether its fuel-cell catalyst, CCM, and MEA activities are progressing with automotive customers.",
    status: "pending"
  },
  {
    company: "FORVIA",
    impact: "financial_update",
    source: "Company announcements / financial reports",
    summary: "Track new hydrogen storage orders, capacity utilization, and commercial vehicle customers.",
    status: "pending"
  }
];

const fallbackSources = [
  { id: "jm-news", title: "Johnson Matthey news", type: "company_official", url: "https://matthey.com/news", note: "Tracks fuel cell, hydrogen, catalyst, CCM, and MEA updates." },
  { id: "forvia-news", title: "FORVIA newsroom", type: "company_official", url: "https://www.forvia.com/en/newsroom", note: "Tracks hydrogen storage systems, tanks, commercial vehicle customers, and capacity updates." },
  { id: "garrett-news", title: "Garrett Motion news", type: "company_official", url: "https://www.garrettmotion.com/news/", note: "Tracks fuel-cell compressors, hydrogen, and electric compressor updates." },
  { id: "doe-fuel-cells", title: "U.S. DOE fuel cells office", type: "government", url: "https://www.energy.gov/eere/fuelcells/hydrogen-and-fuel-cell-technologies-office", note: "Tracks U.S. fuel-cell and hydrogen policy, funding, and technology targets." },
  { id: "umicore-ir", title: "Umicore investors", type: "company_official", url: "https://www.umicore.com/en/investors/", note: "Tracks fuel-cell catalyst, precious-metals, and guidance disclosures." },
  { id: "sgl-ir", title: "SGL Carbon investor relations", type: "company_official", url: "https://www.sglcarbon.com/en/investor-relations/", note: "Tracks GDL, SIGRACET, carbon materials, and fuel-cell business disclosures." },
  { id: "hexagon-purus-ir", title: "Hexagon Purus investor relations", type: "company_official", url: "https://hexagonpurus.com/investor-relations", note: "Tracks high-pressure hydrogen tanks, Type IV cylinders, and commercial vehicle storage systems." },
  { id: "doe-fuel-cell-parts", title: "U.S. DOE fuel cell parts overview", type: "government", url: "https://www.energy.gov/eere/fuelcells/parts-fuel-cell", note: "Supports PEM fuel-cell component, MEA, and bipolar plate baseline structure." },
  { id: "doe-hydrogen-storage", title: "U.S. DOE physical hydrogen storage", type: "government", url: "https://www.energy.gov/eere/fuelcells/physical-hydrogen-storage", note: "Supports the 350 bar / 700 bar compressed hydrogen storage pathway." },
  { id: "jm-fuel-cell-tech", title: "Johnson Matthey fuel cells technology", type: "company_official", url: "https://matthey.com/products-and-services/fuel-cells/fuel-cells-technology", note: "Supports Johnson Matthey's role in catalysts, CCM, and MEA-related fuel-cell activities." },
  { id: "umicore-fuel-cell-catalysts", title: "Umicore fuel cell catalysts", type: "company_official", url: "https://www.umicore.com/en/markets-products/automotive-mobility/fuel-cell-catalysts/", note: "Supports Umicore's fuel-cell catalyst business." },
  { id: "sgl-gdl", title: "SGL Carbon SIGRACET fuel cell components", type: "company_official", url: "https://www.sglcarbon.com/en/markets-solutions/material/sigracet-fuel-cell-components/", note: "Supports SGL Carbon's GDL and fuel-cell component business." },
  { id: "forvia-hydrogen-storage", title: "FORVIA hydrogen storage systems", type: "company_official", url: "https://www.forvia.com/en/pioneering-technologies/electrification-and-energy-management/hydrogen-storage-systems", note: "Supports FORVIA's onboard hydrogen storage systems." },
  { id: "hexagon-purus", title: "Hexagon Purus hydrogen storage systems", type: "company_official", url: "https://hexagongroup.com/hexagon-purus", note: "Supports Hexagon Purus high-pressure hydrogen tanks and systems." },
  { id: "garrett-fuel-cell", title: "Garrett fuel cell technology", type: "company_official", url: "https://www.garrettmotion.com/electric-hybrid/fuel-cell-technology/", note: "Supports Garrett's fuel-cell compressor and air management activities." }
];

const fallbackCompanySources = {
  jm: ["jm-fuel-cell-tech", "doe-fuel-cell-parts"],
  umicore: ["umicore-fuel-cell-catalysts", "doe-fuel-cell-parts"],
  forvia: ["forvia-hydrogen-storage", "doe-hydrogen-storage"],
  garrett: ["garrett-fuel-cell"],
  toray: ["doe-fuel-cell-parts"],
  sgl: ["sgl-gdl", "doe-fuel-cell-parts"],
  hexagon: ["hexagon-purus", "doe-hydrogen-storage"],
  toyota: ["doe-fuel-cell-parts"],
  ballard: ["doe-fuel-cell-parts"]
};

const impactLabels = {
  supply_chain_importance: "Supply chain importance",
  bottleneck_judgement: "Bottleneck judgement",
  financial_update: "Financial / order update",
  new_player: "New player",
  relationship_change: "Relationship change",
  capacity_change: "Capacity change",
  technology_change: "Technology change",
  policy_change: "Policy change"
};

const state = {
  industry: null,
  generatedEvents: [],
  pendingUpdates: loadPendingUpdates()
};

const industrySelect = document.querySelector("#industry-select");
const industryTitle = document.querySelector("#industry-title");
const industryDescription = document.querySelector("#industry-description");
const map = document.querySelector("#supply-chain-map");
const pendingUpdates = document.querySelector("#pending-updates");
const dialog = document.querySelector("#company-dialog");
const detail = document.querySelector("#company-detail");
const form = document.querySelector("#submission-form");
const reviewFilter = document.querySelector("#review-filter");

async function boot() {
  try {
    const [loadedIndustries, generatedEvents] = await Promise.all([
      loadIndustries(),
      loadGeneratedEvents()
    ]);

    industries = loadedIndustries;
    state.generatedEvents = generatedEvents;
    state.industry = industries[0];
    initIndustrySelect();
    bindInteractions();
    render();
  } catch (error) {
    renderLoadError(error);
  }
}

async function loadIndustries() {
  const response = await fetch("data/industries.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Industry data failed to load: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Industry data is empty or malformed.");
  }

  const supplementalIndustries = await loadSupplementalIndustries();
  return mergeIndustries(data, supplementalIndustries);
}

async function loadSupplementalIndustries() {
  const loaded = await Promise.all(
    supplementalIndustryFiles.map((url) => fetchJsonObjectIfAvailable(url))
  );

  return loaded.filter(Boolean);
}

async function fetchJsonObjectIfAvailable(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function mergeIndustries(baseIndustries, supplementalIndustries) {
  const byId = new Map(baseIndustries.map((industry) => [industry.id, industry]));

  supplementalIndustries.forEach((industry) => {
    byId.set(industry.id, industry);
  });

  return Array.from(byId.values());
}

async function loadGeneratedEvents() {
  const data = await fetchJsonIfAvailable("data/generated-update-events.json");
  if (data) return data;

  return await fetchJsonIfAvailable("data/generated-update-events.sample.json") || [];
}

async function fetchJsonIfAvailable(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function loadPendingUpdates() {
  const saved = localStorage.getItem("pendingUpdates");
  if (!saved) return defaultPendingUpdates;

  try {
    return [...defaultPendingUpdates, ...JSON.parse(saved)];
  } catch {
    return defaultPendingUpdates;
  }
}

function saveUserUpdate(update) {
  const saved = localStorage.getItem("pendingUpdates");
  const userUpdates = saved ? JSON.parse(saved) : [];
  userUpdates.unshift(update);
  localStorage.setItem("pendingUpdates", JSON.stringify(userUpdates));
}

function initIndustrySelect() {
  industrySelect.innerHTML = "";

  industries.forEach((industry) => {
    const option = document.createElement("option");
    option.value = industry.id;
    option.textContent = industry.name;
    industrySelect.appendChild(option);
  });
}

function bindInteractions() {
  industrySelect.addEventListener("change", () => {
    state.industry = industries.find((industry) => industry.id === industrySelect.value);
    render();
  });

  document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
  document.querySelector("#reset-view").addEventListener("click", () => {
    map.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  });

  form.addEventListener("submit", handleSubmission);
  reviewFilter.addEventListener("change", renderPendingUpdates);
  pendingUpdates.addEventListener("click", handleReviewAction);
}

function render() {
  industryTitle.textContent = state.industry.name;
  industryDescription.textContent = state.industry.description;
  renderMap();
  renderPendingUpdates();
}

function renderMap() {
  const canvas = document.createElement("div");
  canvas.className = "map-canvas";

  const maxX = Math.max(...state.industry.nodes.map((node) => node.position.x)) + 250;
  const maxY = Math.max(...state.industry.nodes.map((node) => node.position.y)) + 140;
  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${Math.max(maxY, 680)}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("edges");
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", Math.max(maxY, 680));

  state.industry.relationships.forEach(({ from, to }) => {
    const start = state.industry.nodes.find((node) => node.id === from);
    const end = state.industry.nodes.find((node) => node.id === to);
    if (!start || !end) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const x1 = start.position.x + 190;
    const y1 = start.position.y + 41;
    const x2 = end.position.x;
    const y2 = end.position.y + 41;
    const mid = (x1 + x2) / 2;
    path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#b9aa96");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
  });

  canvas.appendChild(svg);

  state.industry.nodes.forEach((node) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `node ${node.type}`;
    element.style.left = `${node.position.x}px`;
    element.style.top = `${node.position.y}px`;
    element.title = `${node.title}: ${node.summary}`;
    element.setAttribute("aria-label", `${node.title}. ${node.summary}`);
    element.innerHTML = `
      <div class="node-title">${node.title}</div>
      <div class="node-meta">${shortNodeMeta(node)}</div>
      <div class="tags"><span class="tag">${primaryNodeBadge(node)}</span></div>
    `;

    if (findCompany(node.id)) {
      element.addEventListener("click", () => openCompany(node.id));
    }

    canvas.appendChild(element);
  });

  map.innerHTML = "";
  map.appendChild(canvas);
}

function shortNodeMeta(node) {
  const company = findCompany(node.id);
  if (company) return "Company";
  return node.layer;
}

function primaryNodeBadge(node) {
  const company = findCompany(node.id);
  if (company?.isZisuCandidate) return "Hidden";
  if (company?.isBottleneck) return "Bottleneck";
  if (company?.isKeySupplier) return "Key supplier";

  const labels = {
    terminal: "Demand",
    chain: "Supply node",
    company: "Company",
    zisu: "Hidden"
  };

  return labels[node.type] || node.layer;
}

function findCompany(nodeId) {
  return state.industry.companies.find((company) => company.id === nodeId);
}

function openCompany(id) {
  const company = findCompany(id);
  if (!company) return;

  const scores = Object.entries(company.scores)
    .map(([label, value]) => `
      <div class="score-row">
        <span>${scoreLabel(label)}</span>
        <div class="bar"><span style="width: ${value}%"></span></div>
        <strong>${value}</strong>
      </div>
    `)
    .join("");

  const signals = Object.entries(company.signals)
    .map(([label, value]) => `
      <div class="signal">
        <strong>${signalLabel(label)}</strong>
        <span>${value}</span>
      </div>
    `)
    .join("");

  detail.innerHTML = `
    <div class="detail-header">
      <h2>${company.name}</h2>
      <div class="detail-subtitle">${company.ticker} - ${company.region} - ${company.businessRole}</div>
    </div>
    ${renderCompanyFlags(company)}
    <div class="signal-grid">${signals}</div>
    <h3>Hidden Bottleneck Score</h3>
    ${scores}
    <h3>Recent Updates / Items to Verify</h3>
    <ul class="recent-list">${company.recentUpdates.map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3>Evidence Sources</h3>
    ${renderSources(sourceIdsForCompany(company))}
  `;

  dialog.showModal();
}

function renderCompanyFlags(company) {
  const flags = [
    ["Key supplier", company.isKeySupplier],
    ["Bottleneck", company.isBottleneck],
    ["Hidden candidate", company.isZisuCandidate]
  ];

  return `
    <div class="company-flags">
      ${flags.map(([label, active]) => `
        <div class="flag-pill ${active ? "active" : "inactive"}">
          <span>${active ? "Yes" : "No"}</span>
          <strong>${label}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function scoreLabel(label) {
  const labels = {
    supplyChainImportance: "Supply chain importance",
    scarcity: "Scarcity",
    pricingPower: "Pricing power",
    switchingCost: "Switching cost",
    validationBarrier: "Validation barrier",
    marketUnderappreciation: "Market underappreciation"
  };

  return labels[label] || label;
}

function signalLabel(label) {
  const labels = {
    importantSupplier: "Important supplier",
    bottleneckPosition: "Bottleneck position",
    playerConcentration: "Player concentration",
    recentCatalyst: "Recent catalyst"
  };

  return labels[label] || label;
}

function sourceById(id) {
  return [...(state.industry.sources || []), ...fallbackSources].find((source) => source.id === id);
}

function sourceIdsForCompany(company) {
  return company.sourceIds || fallbackCompanySources[company.id] || [];
}

function sourceIdsForEvent(event) {
  if (event.sourceIds) return event.sourceIds;
  if (event.companyId && fallbackCompanySources[event.companyId]) return fallbackCompanySources[event.companyId];
  return [];
}

function renderSources(sourceIds = []) {
  const sources = sourceIds.map(sourceById).filter(Boolean);
  if (sources.length === 0) return `<p class="source-empty">No linked sources yet.</p>`;

  return `
    <div class="source-list">
      ${sources.map((source) => `
        <div class="source-item">
          <strong>${source.title}</strong>
          <span>${source.type} - ${source.note}</span>
          ${source.url ? `<a href="${source.url}" target="_blank" rel="noreferrer">Open source</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderPendingUpdates() {
  const allUpdates = buildReviewQueue();
  const visibleUpdates = filterReviewQueue(allUpdates);

  if (visibleUpdates.length === 0) {
    pendingUpdates.innerHTML = `<div class="empty-state">No update events match the current filter.</div>`;
    return;
  }

  pendingUpdates.innerHTML = visibleUpdates
    .map((update) => `
      <article class="update-card ${update.reviewStatus}">
        <strong>${update.company}</strong>
        <span>${reviewStatusLabel(update.reviewStatus)} - ${update.origin} - ${impactLabel(update.impact)}</span>
        <p>${update.summary}</p>
        ${renderAnalysis(update.analysis)}
        <span>Source: ${update.source}</span>
        ${renderSources(update.sourceIds)}
        <div class="review-actions">
          <button type="button" data-review-id="${update.id}" data-review-status="approved">Approve</button>
          <button type="button" data-review-id="${update.id}" data-review-status="needs_more_evidence">Need Evidence</button>
          <button type="button" data-review-id="${update.id}" data-review-status="rejected">Reject</button>
        </div>
      </article>
    `)
    .join("");
}

function buildReviewQueue() {
  const industryEvents = state.industry.updateEvents.map((event) => eventToReviewCard(event, "Map candidate"));

  const generatedEvents = state.generatedEvents
    .filter((event) => event.industryId === state.industry.id)
    .map((event) => eventToReviewCard(event, "AI scan"));

  const userEvents = state.pendingUpdates.map((update) => ({
    id: update.id || stableUpdateId(update),
    company: update.company,
    impact: update.impact,
    origin: "User submission",
    source: update.source,
    sourceIds: update.sourceIds || [],
    summary: update.summary,
    reviewStatus: reviewStatusFor(update.id, update.status)
  }));

  return [...generatedEvents, ...industryEvents, ...userEvents];
}

function eventToReviewCard(event, origin) {
  return {
    id: event.id,
    companyId: event.companyId || null,
    nodeId: event.nodeId || null,
    company: companyLabelForEvent(event),
    impact: event.impactType,
    origin,
    source: event.sourceUrl || event.sourceNote || "No source provided",
    sourceIds: sourceIdsForEvent(event),
    analysis: event.analysis || null,
    summary: event.summary,
    reviewStatus: reviewStatusFor(event.id, event.status)
  };
}

function renderAnalysis(analysis) {
  if (!analysis) return "";

  const checks = (analysis.recommendedChecks || [])
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `
    <div class="analysis-box">
      <strong>Analysis layer: ${analysis.reviewPriority || "medium"} priority</strong>
      <p>${analysis.analystSummary || "Review the source before approving."}</p>
      ${checks ? `<ul>${checks}</ul>` : ""}
      ${analysis.suggestedDatabaseAction ? `<span>${analysis.suggestedDatabaseAction}</span>` : ""}
    </div>
  `;
}

function companyLabelForEvent(event) {
  const company = state.industry.companies.find((item) => item.id === event.companyId);
  if (company) return company.name;

  const node = state.industry.nodes.find((item) => item.id === event.nodeId);
  if (node) return node.title;

  return event.companyId || event.nodeId || state.industry.name;
}

function stableUpdateId(update) {
  return `legacy-${encodeURIComponent(`${update.company}-${update.source}-${update.summary}`)}`;
}

function filterReviewQueue(queue) {
  const selected = reviewFilter.value;
  if (selected === "all") return queue;
  return queue.filter((update) => update.reviewStatus === selected);
}

function reviewStatusFor(id, fallbackStatus) {
  const decisions = loadReviewDecisions();
  return decisions[id] || normalizeReviewStatus(fallbackStatus);
}

function normalizeReviewStatus(status) {
  if (["approved", "rejected", "needs_more_evidence", "pending"].includes(status)) return status;
  return "pending";
}

function reviewStatusLabel(status) {
  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    needs_more_evidence: "Need more evidence"
  };

  return labels[status] || status;
}

function impactLabel(impact) {
  return impactLabels[impact] || impact;
}

function loadReviewDecisions() {
  const saved = localStorage.getItem("reviewDecisions");
  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveReviewDecision(id, status) {
  const decisions = loadReviewDecisions();
  decisions[id] = status;
  localStorage.setItem("reviewDecisions", JSON.stringify(decisions));
}

function handleReviewAction(event) {
  const button = event.target.closest("[data-review-id]");
  if (!button) return;

  saveReviewDecision(button.dataset.reviewId, button.dataset.reviewStatus);
  renderPendingUpdates();
}

function handleSubmission(event) {
  event.preventDefault();

  const update = {
    id: `user-${Date.now()}`,
    company: document.querySelector("#submission-company").value.trim(),
    source: document.querySelector("#submission-source").value.trim(),
    summary: document.querySelector("#submission-summary").value.trim(),
    impact: document.querySelector("#submission-impact").value,
    status: "pending"
  };

  saveUserUpdate(update);
  state.pendingUpdates.unshift(update);
  renderPendingUpdates();
  form.reset();
}

function renderLoadError(error) {
  industryTitle.textContent = "Industry data failed to load";
  industryDescription.textContent = "Open the page through a local web server or the hosted preview link. Some browsers block JSON loading when the file is opened directly.";
  map.innerHTML = `<div class="load-error">${error.message}</div>`;
}

boot();
