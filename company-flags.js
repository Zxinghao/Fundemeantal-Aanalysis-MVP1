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

  document.addEventListener("click", () => {
    setTimeout(injectCompanyFlags, 0);
  });

  function injectCompanyFlags() {
    const detail = document.querySelector("#company-detail");
    const header = detail?.querySelector(".detail-header");
    const companyName = header?.querySelector("h2")?.textContent?.trim();
    const company = companies.find((item) => item.name === companyName);

    if (!detail || !header || !company) return;

    detail.querySelector(".company-flags")?.remove();
    header.insertAdjacentHTML("afterend", renderCompanyFlags(company));
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
})();
