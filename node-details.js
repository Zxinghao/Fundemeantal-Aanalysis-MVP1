(function enhanceNodeDetails() {
  let industries = [];

  fetch("data/industries.json", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : [])
    .then((data) => {
      industries = data;
    })
    .catch(() => {
      industries = [];
    });

  document.addEventListener("click", (event) => {
    const nodeElement = event.target.closest(".node");
    if (!nodeElement) return;

    const title = nodeElement.querySelector(".node-title")?.textContent?.trim();
    const industry = getCurrentIndustry();
    const node = industry?.nodes?.find((item) => item.title === title);
    const company = industry?.companies?.find((item) => item.id === node?.id);

    if (!industry || !node || company) return;

    renderNodeDetail(industry, node);
  });

  function getCurrentIndustry() {
    const selectedId = document.querySelector("#industry-select")?.value;
    return industries.find((industry) => industry.id === selectedId) || industries[0];
  }

  function renderNodeDetail(industry, node) {
    const dialog = document.querySelector("#company-dialog");
    const detail = document.querySelector("#company-detail");
    if (!dialog || !detail) return;

    const connectedCompanies = getConnectedCompanies(industry, node);
    const sources = getNodeSources(industry, node);

    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(node.layer || "Supply chain node")}</p>
          <h2>${escapeHtml(node.title)}</h2>
          <p>${escapeHtml(node.summary || "")}</p>
        </div>
      </div>

      <section class="detail-section">
        <h3>Node Role</h3>
        <p>${escapeHtml(node.summary || "No summary available.")}</p>
        <div class="tag-row">
          ${(node.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </section>

      <section class="detail-section">
        <h3>Connected Companies</h3>
        ${connectedCompanies.length
          ? `<div class="tag-row">${connectedCompanies.map((company) => `<span>${escapeHtml(company.name)}</span>`).join("")}</div>`
          : "<p>No company record is linked to this node yet.</p>"}
      </section>

      <section class="detail-section">
        <h3>Evidence</h3>
        <ul>
          ${sources.length
            ? sources.map((source) => `<li><a href="${escapeAttribute(source.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`).join("")
            : "<li>No source linked yet.</li>"}
        </ul>
      </section>
    `;

    dialog.showModal();
  }

  function getConnectedCompanies(industry, node) {
    return (industry.companies || []).filter((company) => {
      const linkedNodes = company.linkedNodeIds || [];
      return linkedNodes.includes(node.id) || linkedNodes.some((linkedId) => {
        return (industry.relationships || []).some((relationship) => {
          return relationship.from === node.id && relationship.to === linkedId
            || relationship.to === node.id && relationship.from === linkedId;
        });
      });
    });
  }

  function getNodeSources(industry, node) {
    const sourceIds = new Set();
    (industry.relationships || []).forEach((relationship) => {
      if (relationship.from === node.id || relationship.to === node.id) {
        (relationship.sourceIds || []).forEach((sourceId) => sourceIds.add(sourceId));
      }
    });
    return (industry.sources || []).filter((source) => sourceIds.has(source.id));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
