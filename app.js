let industries = [];

const defaultPendingUpdates = [
  {
    id: "seed-jm-progress",
    industryId: "fuel-cell",
    company: "Johnson Matthey",
    impact: "bottleneck_judgement",
    source: "Official materials / investor materials",
    summary: "Verify whether its fuel-cell catalyst, CCM, and MEA activities are progressing with automotive customers.",
    status: "pending"
  },
  {
    id: "seed-forvia-orders",
    industryId: "fuel-cell",
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
  { id: "sgl-gdl", title: "SGL Carbon SIGRACET fuel cell components", type: "company_official", url: "https://www.sglcarbon.com/en/markets-solutions/material/sigracet/", note: "Supports SGL Carbon's GDL and fuel-cell component business." },
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
  scoringRubric: null,
  pendingUpdates: loadPendingUpdates()
};

const industrySelect = document.querySelector("#industry-select");
const industryTitle = document.querySelector("#industry-title");
const industryDescription = document.querySelector("#industry-description");
const map = document.querySelector("#supply-chain-map");
const chainList = document.querySelector("#chain-list");
const deskCount = document.querySelector("#desk-count");
const pendingUpdates = document.querySelector("#pending-updates");
const dialog = document.querySelector("#company-dialog");
const detail = document.querySelector("#company-detail");
const form = document.querySelector("#submission-form");
const reviewFilter = document.querySelector("#review-filter");

async function boot() {
  initShell();
  try {
    const [loadedIndustries, generatedEvents, scoringRubric] = await Promise.all([
      loadIndustries(),
      loadGeneratedEvents(),
      loadScoringRubric()
    ]);

    industries = loadedIndustries;
    state.generatedEvents = generatedEvents;
    state.scoringRubric = scoringRubric;
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

  return data;
}

async function loadGeneratedEvents() {
  const data = await fetchJsonIfAvailable("data/generated-update-events.json");
  if (data) return data;

  return await fetchJsonIfAvailable("data/generated-update-events.sample.json") || [];
}

async function loadScoringRubric() {
  const response = await fetch("data/scoring-rubric.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Scoring rubric failed to load: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.version || !data?.dimensions) {
    throw new Error("Scoring rubric is malformed.");
  }
  return data;
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
  let userUpdates = [];
  try {
    userUpdates = JSON.parse(localStorage.getItem("pendingUpdates") || "[]");
  } catch {
    userUpdates = [];
  }
  userUpdates.unshift(update);
  localStorage.setItem("pendingUpdates", JSON.stringify(userUpdates));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function safeUrl(value) {
  return /^https?:\/\//i.test(String(value || "")) ? esc(value) : "";
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
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
    const chip = event.target.closest("[data-open-company]");
    if (chip) openCompany(chip.dataset.openCompany);
  });
  bindGraphZoom();

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
  renderChainList();
  renderGraph();
}

function renderGraph() {
  const canvas = document.createElement("div");
  canvas.className = "map-canvas";

  const maxX = Math.max(...state.industry.nodes.map((node) => node.position.x)) + 250;
  const maxY = Math.max(...state.industry.nodes.map((node) => node.position.y)) + 140;
  const canvasHeight = maxY;
  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${canvasHeight}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("edges");
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", canvasHeight);

  state.industry.relationships.forEach(({ from, to }) => {
    const start = state.industry.nodes.find((node) => node.id === from);
    const end = state.industry.nodes.find((node) => node.id === to);
    if (!start || !end) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const x1 = start.position.x + 184;
    const y1 = start.position.y + 41;
    const x2 = end.position.x;
    const y2 = end.position.y + 41;
    const mid = (x1 + x2) / 2;
    path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#b6bcc6");
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
    element.setAttribute("aria-label", `${node.title}. ${node.summary}`);
    const tags = document.createElement("div");
    tags.className = "tags";
    tags.append(elementWith("span", "tag", primaryNodeBadge(node)));
    element.append(
      elementWith("div", "node-title", node.title),
      elementWith("div", "node-meta", shortNodeMeta(node)),
      tags
    );
    element.addEventListener("click", () => openDetail(node.id));

    canvas.appendChild(element);
  });

  const sizer = document.createElement("div");
  sizer.className = "map-sizer";
  sizer.appendChild(canvas);
  map.innerHTML = "";
  map.appendChild(sizer);

  graph.canvas = canvas;
  graph.sizer = sizer;
  graph.width = maxX;
  graph.height = canvasHeight;
  graph.userZoomed = false;
  fitGraph();
}

// ---------- Graph zoom: buttons, pinch, and ctrl/cmd + wheel ----------

const graph = { canvas: null, sizer: null, width: 0, height: 0, zoom: 1, userZoomed: false };
const MAX_ZOOM = 1.6;

function fitZoom() {
  if (!graph.width || !map.clientWidth) return 1;
  return Math.min(1, (map.clientWidth - 16) / graph.width, (map.clientHeight - 16) / graph.height);
}

function fitGraph() {
  if (!graph.canvas || !map.clientWidth) return;
  graph.userZoomed = false;
  applyGraphZoom(fitZoom());
  map.scrollTo(0, 0);
}

// Zoom while keeping the content under the focal point (viewport coordinates) in place.
function zoomGraphTo(zoom, focalX = map.clientWidth / 2, focalY = map.clientHeight / 2) {
  if (!graph.canvas) return;
  const next = Math.min(MAX_ZOOM, Math.max(fitZoom(), zoom));
  const offsetX = graph.sizer.offsetLeft;
  const offsetY = graph.sizer.offsetTop;
  const contentX = (map.scrollLeft + focalX - offsetX) / graph.zoom;
  const contentY = (map.scrollTop + focalY - offsetY) / graph.zoom;
  graph.userZoomed = true;
  applyGraphZoom(next);
  map.scrollLeft = contentX * next + graph.sizer.offsetLeft - focalX;
  map.scrollTop = contentY * next + graph.sizer.offsetTop - focalY;
}

function applyGraphZoom(zoom) {
  graph.zoom = zoom;
  graph.canvas.style.transform = `scale(${zoom})`;
  graph.sizer.style.width = `${graph.width * zoom}px`;
  graph.sizer.style.height = `${graph.height * zoom}px`;
  const label = document.querySelector("#zoom-level");
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
  const atFit = zoom <= fitZoom() + 0.001;
  document.querySelector("#zoom-out").disabled = atFit;
  document.querySelector("#zoom-in").disabled = zoom >= MAX_ZOOM - 0.001;
}

function refitGraphIfUntouched() {
  if (graph.canvas && !graph.userZoomed) fitGraph();
}

function bindGraphZoom() {
  document.querySelector("#zoom-in").addEventListener("click", () => zoomGraphTo(graph.zoom * 1.35));
  document.querySelector("#zoom-out").addEventListener("click", () => zoomGraphTo(graph.zoom / 1.35));
  document.querySelector("#reset-view").addEventListener("click", fitGraph);
  window.addEventListener("resize", refitGraphIfUntouched);

  let pinch = null;
  const distance = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  map.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) pinch = { distance: distance(event.touches), zoom: graph.zoom };
  }, { passive: true });

  map.addEventListener("touchmove", (event) => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const rect = map.getBoundingClientRect();
    const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
    const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
    zoomGraphTo(pinch.zoom * (distance(event.touches) / pinch.distance), midX, midY);
  }, { passive: false });

  const endPinch = (event) => {
    if (event.touches.length < 2) pinch = null;
  };
  map.addEventListener("touchend", endPinch, { passive: true });
  map.addEventListener("touchcancel", endPinch, { passive: true });

  map.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = map.getBoundingClientRect();
    zoomGraphTo(graph.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
}

// ---------- App shell: view tabs + list/graph toggle ----------

const VIEWS = ["chain", "made", "desk"];

function initShell() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });
  document.querySelectorAll("[data-map-mode]").forEach((button) => {
    button.addEventListener("click", () => setMapMode(button.dataset.mapMode, true));
  });
  window.addEventListener("hashchange", () => showView(viewFromHash(), false));

  const savedMode = readPreference("mapMode");
  const wide = window.matchMedia("(min-width: 900px)").matches;
  setMapMode(savedMode === "graph" || savedMode === "list" ? savedMode : (wide ? "graph" : "list"), false);
  showView(viewFromHash(), false);
}

function viewFromHash() {
  const view = window.location.hash.replace("#", "");
  return VIEWS.includes(view) ? view : "chain";
}

function showView(view, updateHash = true) {
  if (!VIEWS.includes(view)) return;
  document.body.dataset.view = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    if (button.dataset.viewTarget === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (updateHash && viewFromHash() !== view) {
    try {
      history.pushState(null, "", `#${view}`);
    } catch {
      // Navigation still works without a history entry.
    }
  }
  if (updateHash) window.scrollTo(0, 0);
  if (view === "chain") refitGraphIfUntouched();
  document.dispatchEvent(new CustomEvent("radar:view", { detail: { view } }));
}

function setMapMode(mode, persist) {
  document.body.dataset.mapMode = mode;
  document.querySelectorAll("[data-map-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapMode === mode));
  });
  if (persist) writePreference("mapMode", mode);
  refitGraphIfUntouched();
}

function readPreference(key) {
  try {
    return localStorage.getItem(`radar.${key}`);
  } catch {
    return null;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(`radar.${key}`, value);
  } catch {
    // Preferences are a convenience only.
  }
}

function selectIndustry(industryId) {
  const industry = industries.find((item) => item.id === industryId);
  if (!industry) return false;
  industrySelect.value = industryId;
  industrySelect.dispatchEvent(new Event("change"));
  return true;
}

globalThis.RadarApp = { showView, selectIndustry, openDetail: (id) => openDetail(id) };

// ---------- Layered supply-chain list (phone-friendly alternative to the graph) ----------

function renderChainList() {
  const industry = state.industry;
  const companyIds = new Set(industry.companies.map((company) => company.id));
  const chainNodes = industry.nodes.filter((node) => !companyIds.has(node.id));
  const columns = [...new Set(chainNodes.map((node) => node.position.x))].sort((a, b) => a - b);
  const placedCompanies = new Set();

  chainList.replaceChildren();

  columns.forEach((x, index) => {
    const nodes = chainNodes
      .filter((node) => node.position.x === x)
      .sort((a, b) => a.position.y - b.position.y);
    const layers = [...new Set(nodes.map((node) => node.layer))];

    const stage = element("section", "stage");
    const head = element("div", "stage-head");
    head.append(
      element("b", "", String(index + 1).padStart(2, "0")),
      element("span", "", layers.join(" · "))
    );
    const list = element("div", "stage-nodes");

    nodes.forEach((node) => {
      const companies = industry.companies.filter((company) => (company.linkedNodeIds || []).includes(node.id));
      companies.forEach((company) => placedCompanies.add(company.id));
      list.append(chainNodeCard(node, companies));
    });

    stage.append(head, list);
    chainList.append(stage);
  });

  const orphans = industry.companies.filter((company) => !placedCompanies.has(company.id));
  if (orphans.length) {
    const stage = element("section", "stage");
    const head = element("div", "stage-head");
    head.append(element("b", "", "+"), element("span", "", "Other companies"));
    const row = element("div", "node-companies");
    orphans.forEach((company) => row.append(companyChip(company)));
    stage.append(head, row);
    chainList.append(stage);
  }
}

function chainNodeCard(node, companies) {
  const card = element("article", `node-card ${node.type}`);

  const button = element("button", "node");
  button.type = "button";
  button.append(
    element("span", "node-title", node.title),
    element("span", "chev", "›"),
    element("span", "node-summary", node.summary || "")
  );
  button.addEventListener("click", () => openDetail(node.id));
  card.append(button);

  if (companies.length) {
    const row = element("div", "node-companies");
    companies.forEach((company) => row.append(companyChip(company)));
    card.append(row);
  }
  return card;
}

function companyChip(company) {
  const chip = element("button", `company-chip${company.isZisuCandidate ? " zisu" : ""}`);
  chip.type = "button";
  chip.append(element("i"), element("span", "", company.name));
  const badge = company.isZisuCandidate ? "Hidden" : company.isBottleneck ? "Bottleneck" : "";
  if (badge) chip.append(element("small", "", badge));
  chip.addEventListener("click", () => openCompany(company.id));
  return chip;
}

function elementWith(tag, className, text) {
  return element(tag, className, text);
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
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

function openDetail(nodeId) {
  if (findCompany(nodeId)) openCompany(nodeId);
  else openNode(nodeId);
}

function openNode(nodeId) {
  const industry = state.industry;
  const node = industry.nodes.find((item) => item.id === nodeId);
  if (!node) return;

  const companies = industry.companies.filter((company) => (company.linkedNodeIds || []).includes(node.id));
  const sourceIds = new Set();
  industry.relationships.forEach((relationship) => {
    if (relationship.from === node.id || relationship.to === node.id) {
      (relationship.sourceIds || []).forEach((sourceId) => sourceIds.add(sourceId));
    }
  });

  detail.dataset.nodeId = node.id;
  detail.innerHTML = `
    <div class="detail-header">
      <p class="eyebrow">${esc(node.layer || "Supply chain node")}</p>
      <h2>${esc(node.title)}</h2>
      <p>${esc(node.summary || "No summary available.")}</p>
    </div>
    <div class="tag-row">${(node.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>
    <h3>Companies at this node</h3>
    ${companies.length
      ? `<div class="node-companies in-dialog">${companies.map((company) => `
          <button type="button" class="company-chip${company.isZisuCandidate ? " zisu" : ""}" data-open-company="${esc(company.id)}"><i></i><span>${esc(company.name)}</span></button>
        `).join("")}</div>`
      : `<p class="source-empty">No company record is linked to this node yet.</p>`}
    <h3>Evidence Sources</h3>
    ${renderSources([...sourceIds])}
  `;

  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function openCompany(id) {
  const company = findCompany(id);
  if (!company) return;

  const composite = computeCompositeScore(company.scores);
  const classification = classifyComposite(composite);
  const dimensions = Object.entries(state.scoringRubric?.dimensions || {});
  const scores = dimensions
    .map(([label, config]) => {
      const value = company.scores?.[label];
      const weight = Math.round((config.weight || 0) * 100);
      return `
        <div class="score-row">
          <span>${esc(config.label || scoreLabel(label))} <small>${weight}%</small></span>
          <div class="bar"><span style="width: ${Number(value) || 0}%"></span></div>
          <strong>${esc(value ?? "–")}</strong>
        </div>
      `;
    })
    .join("");

  const signals = Object.entries(company.signals)
    .map(([label, value]) => `
      <div class="signal">
        <strong>${esc(signalLabel(label))}</strong>
        <span>${esc(value)}</span>
      </div>
    `)
    .join("");

  detail.dataset.nodeId = company.id;
  detail.innerHTML = `
    <div class="detail-header">
      <h2>${esc(company.name)}</h2>
      <div class="detail-subtitle">${esc(company.ticker)} · ${esc(company.region)} · ${esc(company.businessRole)}</div>
    </div>
    ${renderCompanyFlags(company)}
    <div class="signal-grid">${signals}</div>
    <h3>Hidden Bottleneck Composite</h3>
    <div class="composite-score">
      <strong>${Number.isFinite(composite) ? composite.toFixed(1) : "N/A"}</strong>
      <span>${esc(classification || "Unclassified")}</span>
      <small>Rubric v${esc(state.scoringRubric.version)}. Component inputs are currently ${esc(state.scoringRubric.evidencePolicy?.status || "provisional")}; the composite is arithmetic, not independent evidence.</small>
    </div>
    <h3>Component Scores</h3>
    ${scores}
    <p class="score-policy">${esc(state.scoringRubric.evidencePolicy?.requirement || "Component scores require explicit evidence coverage.")}</p>
    <h3>Recent Updates / Items to Verify</h3>
    <ul class="recent-list">${(company.recentUpdates || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    <h3>Evidence Sources</h3>
    ${renderSources(sourceIdsForCompany(company))}
  `;

  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function computeCompositeScore(scores) {
  const dimensions = state.scoringRubric?.dimensions || {};
  let weighted = 0;
  let totalWeight = 0;

  Object.entries(dimensions).forEach(([dimension, config]) => {
    const value = scores?.[dimension];
    const weight = Number(config?.weight);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight < 0) return;
    weighted += value * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : null;
}

function classifyComposite(score) {
  if (!Number.isFinite(score)) return null;
  const classifications = [...(state.scoringRubric?.classifications || [])]
    .sort((a, b) => b.min - a.min);
  return classifications.find((entry) => score >= entry.min)?.label || null;
}

function renderCompanyFlags(company) {
  const flags = [
    ["Key supplier (manual)", company.isKeySupplier],
    ["Bottleneck (manual)", company.isBottleneck],
    ["Hidden candidate (manual)", company.isZisuCandidate]
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
          <strong>${esc(source.title)}</strong>
          <span>${esc(source.type)}${source.note ? ` · ${esc(source.note)}` : ""}</span>
          ${safeUrl(source.url) ? `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">Open source ↗</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderPendingUpdates() {
  const allUpdates = buildReviewQueue();
  const visibleUpdates = filterReviewQueue(allUpdates);
  const pendingCount = allUpdates.filter((update) => update.reviewStatus === "pending").length;
  if (deskCount) {
    deskCount.textContent = String(pendingCount);
    deskCount.hidden = pendingCount === 0;
  }

  if (visibleUpdates.length === 0) {
    pendingUpdates.innerHTML = `<div class="empty-state">No update events match the current filter.</div>`;
    return;
  }

  pendingUpdates.innerHTML = visibleUpdates
    .map((update) => `
      <article class="update-card ${esc(update.reviewStatus)}">
        <strong>${esc(update.company)}</strong>
        <span>${esc(reviewStatusLabel(update.reviewStatus))} · ${esc(update.origin)} · ${esc(impactLabel(update.impact))}</span>
        <p>${esc(update.summary)}</p>
        <details class="update-more">
          <summary>Evidence, claim &amp; sources</summary>
          ${renderResearchPacket(update.researchPacket)}
          ${renderAnalysis(update.analysis)}
          <span>Source: ${esc(update.source)}</span>
          ${renderSources(update.sourceIds)}
        </details>
        <div class="review-actions">
          <button type="button" data-review-id="${esc(update.id)}" data-review-status="approved">Approve</button>
          <button type="button" data-review-id="${esc(update.id)}" data-review-status="needs_more_evidence">Need Evidence</button>
          <button type="button" data-review-id="${esc(update.id)}" data-review-status="rejected">Reject</button>
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

  const userEvents = state.pendingUpdates
    .filter((update) => !update.industryId || update.industryId === state.industry.id)
    .map((update) => ({
    id: update.id || stableUpdateId(update),
    company: update.company,
    impact: update.impact,
    origin: "User submission",
    source: update.source,
    sourceIds: update.sourceIds || [],
    analysis: null,
    researchPacket: null,
    summary: update.summary,
    reviewStatus: reviewStatusFor(update.id || stableUpdateId(update), update.status)
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
    researchPacket: event.researchPacket || null,
    summary: event.summary,
    reviewStatus: reviewStatusFor(event.id, event.status)
  };
}

function renderResearchPacket(packet) {
  if (!packet) return "";

  const evidence = (packet.evidence || [])
    .map((item) => `
      <div class="research-evidence">
        <strong>Evidence ${esc(item.evidenceLevel || "?")}: ${esc(item.pageTitle || item.sourceId || "Source observation")}</strong>
        <p>${esc(item.observation || "No observation recorded.")}</p>
        ${item.limitation ? `<small>${esc(item.limitation)}</small>` : ""}
      </div>
    `)
    .join("");

  const operations = (packet.proposedPatch?.operations || [])
    .map((operation) => `
      <li><code>${esc(operation.op)}</code> <code>${esc(operation.path)}</code>${operation.requiresHumanInput ? " - human input required" : ""}</li>
    `)
    .join("");

  return `
    <div class="research-packet">
      <div class="research-stage">
        <span>1. Evidence</span>
        ${evidence || "<p>No structured evidence.</p>"}
      </div>
      <div class="research-stage">
        <span>2. Claim - ${esc(packet.claim?.status || "unverified")} / ${esc(packet.claim?.confidence || "low")} confidence</span>
        <p>${esc(packet.claim?.statement || "No claim statement.")}</p>
        ${packet.claim?.rationale ? `<small>${esc(packet.claim.rationale)}</small>` : ""}
      </div>
      <div class="research-stage">
        <span>3. Proposed Patch - ${esc(packet.proposedPatch?.status || "draft")}${packet.proposedPatch?.executable ? " / executable" : " / not executable"}</span>
        ${operations ? `<ul>${operations}</ul>` : "<p>No patch operations.</p>"}
      </div>
    </div>
  `;
}

function renderAnalysis(analysis) {
  if (!analysis) return "";

  const checks = (analysis.recommendedChecks || [])
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");

  return `
    <div class="analysis-box">
      <strong>Review guidance: ${esc(analysis.reviewPriority || "medium")} priority</strong>
      <p>${esc(analysis.analystSummary || "Review the source before approving.")}</p>
      ${checks ? `<ul>${checks}</ul>` : ""}
      ${analysis.suggestedDatabaseAction ? `<span>${esc(analysis.suggestedDatabaseAction)}</span>` : ""}
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
    industryId: state.industry.id,
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
  map.innerHTML = `<div class="load-error">${esc(error.message)}</div>`;
  chainList.replaceChildren(element("div", "load-error", error.message));
}

boot();
