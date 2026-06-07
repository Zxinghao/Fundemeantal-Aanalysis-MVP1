(function enhanceCompanyDialogFlags() {
  const originalOpenCompany = window.openCompany;

  if (typeof originalOpenCompany !== "function") return;

  window.openCompany = function openCompanyWithFlags(id) {
    originalOpenCompany(id);

    const detail = document.querySelector("#company-detail");
    const header = detail?.querySelector(".detail-header");
    const company = typeof window.findCompany === "function" ? window.findCompany(id) : null;

    if (!detail || !header || !company) return;

    detail.querySelector(".company-flags")?.remove();
    header.insertAdjacentHTML("afterend", renderCompanyFlags(company));
  };

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
})();
