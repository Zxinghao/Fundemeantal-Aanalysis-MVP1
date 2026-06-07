(function enhanceCompanyDialogFlags() {
  let companies = [];

  fetch("data/industries.json", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : [])
    .then((industries) => {
      companies = industries.flatMap((industry) => industry.companies || []);
      injectCompanyFlags();
    })
    .catch(() => {
      companies = [];
    });

  const detail = document.querySelector("#company-detail");
  if (detail) {
    const observer = new MutationObserver(() => injectCompanyFlags());
    observer.observe(detail, { childList: true, subtree: true });
  }

  function injectCompanyFlags() {
    const detail = document.querySelector("#company-detail");
    const header = detail?.querySelector(".detail-header");
    const companyName = header?.querySelector("h2")?.textContent?.trim();
    const company = companies.find((item) => item.name === companyName);

    if (!detail || !header || !company) return;

    const currentFlags = detail.querySelector(".company-flags");
    if (currentFlags?.dataset.companyName === companyName) return;

    currentFlags?.remove();
    header.insertAdjacentHTML("afterend", renderCompanyFlags(company, companyName));
  }

  function renderCompanyFlags(company, companyName) {
    const flags = [
      ["Key supplier", company.isKeySupplier],
      ["Bottleneck", company.isBottleneck],
      ["Hidden candidate", company.isZisuCandidate]
    ];

    return `
      <div class="company-flags" data-company-name="${escapeAttribute(companyName)}">
        ${flags.map(([label, active]) => `
          <div class="flag-pill ${active ? "active" : "inactive"}">
            <span>${active ? "Yes" : "No"}</span>
            <strong>${label}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function escapeAttribute(value) {
    return String(value).replace(/"/g, "&quot;");
  }
})();
