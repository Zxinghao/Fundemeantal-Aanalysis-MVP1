let industries = [];

const defaultPendingUpdates = [
  {
    company: "Johnson Matthey",
    impact: "卡脖子判断",
    source: "官方资料 / 投资者材料",
    summary: "需要核验其燃料电池催化剂、CCM 与 MEA 业务在汽车客户中的验证进展。",
    status: "AI 候选"
  },
  {
    company: "FORVIA",
    impact: "财报/订单动态",
    source: "公司公告 / 财报",
    summary: "跟踪氢储能系统新订单、产能利用率和商用车客户。",
    status: "每周追踪"
  }
];

const fallbackSources = [
  { id: "jm-news", title: "Johnson Matthey news", type: "company_official", url: "https://matthey.com/news", note: "用于跟踪燃料电池、氢能、催化剂、CCM、MEA 相关新闻。" },
  { id: "forvia-news", title: "FORVIA newsroom", type: "company_official", url: "https://www.forvia.com/en/newsroom", note: "用于跟踪氢储能系统、储氢瓶、商用车客户和产能动态。" },
  { id: "doe-fuel-cells", title: "U.S. DOE fuel cells office", type: "government", url: "https://www.energy.gov/eere/fuelcells/hydrogen-and-fuel-cell-technologies-office", note: "用于跟踪美国燃料电池与氢能政策、资金和技术目标。" },
  { id: "doe-fuel-cell-parts", title: "U.S. DOE fuel cell parts overview", type: "government", url: "https://www.energy.gov/eere/fuelcells/parts-fuel-cell", note: "支撑 PEM 燃料电池关键部件、MEA、双极板等基础结构。" },
  { id: "doe-hydrogen-storage", title: "U.S. DOE physical hydrogen storage", type: "government", url: "https://www.energy.gov/eere/fuelcells/physical-hydrogen-storage", note: "支撑 350bar/700bar 车载压缩氢储存路线。" },
  { id: "jm-fuel-cell-tech", title: "Johnson Matthey fuel cells technology", type: "company_official", url: "https://matthey.com/products-and-services/fuel-cells/fuel-cells-technology", note: "支撑 Johnson Matthey 在燃料电池催化剂、CCM、MEA 相关环节的业务描述。" },
  { id: "umicore-fuel-cell-catalysts", title: "Umicore fuel cell catalysts", type: "company_official", url: "https://www.umicore.com/en/markets-products/automotive-mobility/fuel-cell-catalysts/", note: "支撑 Umicore 燃料电池催化剂业务。" },
  { id: "sgl-gdl", title: "SGL Carbon SIGRACET fuel cell components", type: "company_official", url: "https://www.sglcarbon.com/en/markets-solutions/material/sigracet-fuel-cell-components/", note: "支撑 SGL Carbon GDL 与燃料电池组件业务。" },
  { id: "forvia-hydrogen-storage", title: "FORVIA hydrogen storage systems", type: "company_official", url: "https://www.forvia.com/en/pioneering-technologies/electrification-and-energy-management/hydrogen-storage-systems", note: "支撑 FORVIA 车载储氢系统业务。" },
  { id: "hexagon-purus", title: "Hexagon Purus hydrogen storage systems", type: "company_official", url: "https://hexagongroup.com/hexagon-purus", note: "支撑 Hexagon Purus 高压储氢瓶与系统业务。" },
  { id: "garrett-fuel-cell", title: "Garrett fuel cell technology", type: "company_official", url: "https://www.garrettmotion.com/electric-hybrid/fuel-cell-technology/", note: "支撑 Garrett 燃料电池空压机/空气管理相关业务。" }
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
    throw new Error(`行业数据加载失败：${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("行业数据为空或格式不正确。");
  }

  return data;
}

async function loadGeneratedEvents() {
  try {
    const response = await fetch("data/generated-update-events.sample.json", { cache: "no-store" });
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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
    element.innerHTML = `
      <div class="node-title">${node.title}</div>
      <div class="node-meta">${node.summary}</div>
      <div class="tags">${node.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
    `;

    if (findCompany(node.id)) {
      element.addEventListener("click", () => openCompany(node.id));
    }

    canvas.appendChild(element);
  });

  map.innerHTML = "";
  map.appendChild(canvas);
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
      <div class="detail-subtitle">${company.ticker} · ${company.region} · ${company.businessRole}</div>
    </div>
    <div class="signal-grid">${signals}</div>
    <h3>紫苏叶评分</h3>
    ${scores}
    <h3>最近动态 / 待验证事项</h3>
    <ul class="recent-list">${company.recentUpdates.map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3>证据来源</h3>
    ${renderSources(sourceIdsForCompany(company))}
  `;

  dialog.showModal();
}

function scoreLabel(label) {
  const labels = {
    supplyChainImportance: "供应链重要性",
    scarcity: "稀缺性",
    pricingPower: "定价权",
    switchingCost: "切换成本",
    validationBarrier: "验证壁垒",
    marketUnderappreciation: "市场低估"
  };

  return labels[label] || label;
}

function signalLabel(label) {
  const labels = {
    importantSupplier: "重要供应商",
    bottleneckPosition: "卡脖子位置",
    playerConcentration: "玩家集中度",
    recentCatalyst: "近期催化剂"
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
  if (sources.length === 0) return `<p class="source-empty">暂无绑定来源。</p>`;

  return `
    <div class="source-list">
      ${sources.map((source) => `
        <div class="source-item">
          <strong>${source.title}</strong>
          <span>${source.type} · ${source.note}</span>
          ${source.url ? `<a href="${source.url}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderPendingUpdates() {
  const allUpdates = buildReviewQueue();
  const visibleUpdates = filterReviewQueue(allUpdates);

  if (visibleUpdates.length === 0) {
    pendingUpdates.innerHTML = `<div class="empty-state">当前筛选条件下没有更新事件。</div>`;
    return;
  }

  pendingUpdates.innerHTML = visibleUpdates
    .map((update) => `
      <article class="update-card ${update.reviewStatus}">
        <strong>${update.company}</strong>
        <span>${reviewStatusLabel(update.reviewStatus)} · ${update.origin} · ${update.impact}</span>
        <p>${update.summary}</p>
        <span>来源：${update.source}</span>
        ${renderSources(update.sourceIds)}
        <div class="review-actions">
          <button type="button" data-review-id="${update.id}" data-review-status="approved">通过</button>
          <button type="button" data-review-id="${update.id}" data-review-status="needs_more_evidence">补证据</button>
          <button type="button" data-review-id="${update.id}" data-review-status="rejected">拒绝</button>
        </div>
      </article>
    `)
    .join("");
}

function buildReviewQueue() {
  const industryEvents = state.industry.updateEvents.map((event) => eventToReviewCard(event, "图谱候选"));

  const generatedEvents = state.generatedEvents
    .filter((event) => event.industryId === state.industry.id)
    .map((event) => eventToReviewCard(event, "AI 扫描"));

  const userEvents = state.pendingUpdates.map((update) => ({
    id: update.id || stableUpdateId(update),
    company: update.company,
    impact: update.impact,
    origin: "用户提交",
    source: update.source,
    sourceIds: update.sourceIds || [],
    summary: update.summary,
    reviewStatus: reviewStatusFor(update.id || stableUpdateId(update), update.status)
  }));

  return [...generatedEvents, ...industryEvents, ...userEvents];
}

function eventToReviewCard(event, origin) {
  return {
    id: event.id,
    company: companyLabelForEvent(event),
    impact: event.impactType,
    origin,
    source: event.sourceUrl || event.sourceNote || "未提供来源",
    sourceIds: sourceIdsForEvent(event),
    summary: event.summary,
    reviewStatus: reviewStatusFor(event.id, event.status)
  };
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
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
    needs_more_evidence: "需补证据"
  };

  return labels[status] || status;
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
  industryTitle.textContent = "行业数据加载失败";
  industryDescription.textContent = "请通过本地网页服务或线上链接打开页面，直接双击本地文件时部分浏览器会限制 JSON 数据读取。";
  map.innerHTML = `<div class="load-error">${error.message}</div>`;
}

boot();
