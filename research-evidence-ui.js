(function enhanceResearchEvidenceUi() {
  let industries = [];
  let rubric = null;
  let watchlist = {};
  let generatedEvents = [];
  let companyEnhancing = false;
  let reviewEnhancing = false;

  Promise.all([
    fetchJson("data/industries.json", []),
    fetchJson("data/scoring-rubric.json", null),
    fetchJson("data/source-watchlist.json", {}),
    fetchJson("data/generated-update-events.json", [])
  ]).then(([loadedIndustries, loadedRubric, loadedWatchlist, loadedEvents]) => {
    industries = Array.isArray(loadedIndustries) ? loadedIndustries : [];
    rubric = loadedRubric;
    watchlist = loadedWatchlist || {};
    generatedEvents = Array.isArray(loadedEvents) ? loadedEvents : [];

    const detail = document.querySelector("#company-detail");
    const pending = document.querySelector("#pending-updates");

    if (detail) {
      new MutationObserver(enhanceCompanyDetail).observe(detail, { childList: true, subtree: true });
      enhanceCompanyDetail();
    }

    if (pending) {
      new MutationObserver(enhanceReviewDiffs).observe(pending, { childList: true, subtree: true });
      enhanceReviewDiffs();
    }
  }).catch(() => {});

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return fallback;
      return await response.json();
    } catch {
      return fallback;
    }
  }

  function findCompanyContext(companyName) {
    for (const industry of industries) {
      const company = (industry.companies || []).find((candidate) => candidate.name === companyName);
      if (company) return { industry, company };
    }
    return null;
  }

  function sourceLabel(industry, sourceId) {
    const canonical = (industry.sources || []).find((source) => source.id === sourceId);
    if (canonical) return canonical.title || canonical.id;

    const cadenceMap = watchlist[industry.id] || {};
    const watched = [...(cadenceMap.daily || []), ...(cadenceMap.weekly || [])]
      .find((source) => source.id === sourceId);
    return watched?.name || sourceId;
  }

  function enhanceCompanyDetail() {
    if (companyEnhancing || !rubric?.dimensions) return;
    const detail = document.querySelector("#company-detail");
    const companyName = detail?.querySelector(".detail-header h2")?.textContent?.trim();
    if (!detail || !companyName) return;

    const context = findCompanyContext(companyName);
    if (!context) return;
    const { industry, company } = context;
    const marker = detail.querySelector(".score-evidence-record[data-evidence-company]");
    if (marker?.dataset.evidenceCompany === companyName) return;

    companyEnhancing = true;
    try {
      detail.querySelectorAll(".score-evidence-record, .score-evidence-coverage").forEach((element) => element.remove());

      const dimensions = Object.entries(rubric.dimensions);
      const rows = [...detail.querySelectorAll(".score-row")];
      let coverage = 0;

      dimensions.forEach(([dimension], index) => {
        const row = rows[index];
        if (!row) return;
        const record = company.scoreEvidence?.[dimension] || null;
        if (record) coverage += 1;

        const evidence = document.createElement("div");
        evidence.className = `score-evidence-record ${record ? "supported" : "missing"}`;
        evidence.dataset.evidenceCompany = companyName;

        const heading = document.createElement("strong");
        heading.textContent = record
          ? `Evidence-backed · ${record.evidenceDate || "date missing"}`
          : "Evidence gap · provisional input";
        evidence.appendChild(heading);

        const description = document.createElement("p");
        description.textContent = record?.rationale
          || "No dimension-specific rationale, source IDs, evidence date, and provenance have been attached to this score yet.";
        evidence.appendChild(description);

        if (record) {
          const sourceText = document.createElement("small");
          sourceText.textContent = `Sources: ${(record.sourceIds || []).map((sourceId) => sourceLabel(industry, sourceId)).join("; ") || "missing"}`;
          evidence.appendChild(sourceText);

          const provenance = document.createElement("small");
          const provenanceParts = [record.provenance?.type, record.provenance?.eventId, record.provenance?.claimId].filter(Boolean);
          provenance.textContent = `Provenance: ${provenanceParts.join(" · ") || "missing"}`;
          evidence.appendChild(provenance);
        }

        row.insertAdjacentElement("afterend", evidence);
      });

      const composite = detail.querySelector(".composite-score");
      if (composite) {
        const coverageNote = document.createElement("small");
        coverageNote.className = "score-evidence-coverage";
        coverageNote.textContent = `Dimension evidence coverage: ${coverage}/${dimensions.length}. A composite can be reproducible while its inputs are still under-evidenced.`;
        composite.appendChild(coverageNote);
      }
    } finally {
      companyEnhancing = false;
    }
  }

  function enhanceReviewDiffs() {
    if (reviewEnhancing) return;
    const pending = document.querySelector("#pending-updates");
    if (!pending) return;

    reviewEnhancing = true;
    try {
      pending.querySelectorAll(".update-card").forEach((card) => {
        const reviewId = card.querySelector("[data-review-id]")?.dataset.reviewId;
        if (!reviewId || card.querySelector(".change-evidence-panel")) return;
        const event = generatedEvents.find((candidate) => candidate.id === reviewId);
        const changeSet = event?.researchPacket?.evidence?.[0]?.changeSet || event?.changeEvidence;
        if (!changeSet || changeSet.status === "unchanged") return;

        const panel = document.createElement("div");
        panel.className = `change-evidence-panel ${changeSet.status}`;

        const title = document.createElement("strong");
        title.textContent = changeSet.status === "comparable"
          ? `Watched-context diff · +${changeSet.addedCount || 0} / -${changeSet.removedCount || 0}`
          : "Watched-context baseline not yet comparable";
        panel.appendChild(title);

        const note = document.createElement("p");
        note.textContent = changeSet.note || "Review the primary source before supporting a claim.";
        panel.appendChild(note);

        appendSnippetGroup(panel, "Added context", changeSet.added, "added");
        appendSnippetGroup(panel, "Removed context", changeSet.removed, "removed");
        appendSnippetGroup(panel, "Current relevant context", changeSet.currentRelevant, "current");

        const researchPacket = card.querySelector(".research-packet");
        if (researchPacket) researchPacket.insertAdjacentElement("afterend", panel);
        else card.querySelector("p")?.insertAdjacentElement("afterend", panel);
      });
    } finally {
      reviewEnhancing = false;
    }
  }

  function appendSnippetGroup(panel, label, snippets, kind) {
    if (!Array.isArray(snippets) || snippets.length === 0) return;

    const group = document.createElement("div");
    group.className = `change-snippet-group ${kind}`;
    const heading = document.createElement("span");
    heading.textContent = label;
    group.appendChild(heading);

    const list = document.createElement("ul");
    snippets.forEach((snippet) => {
      const item = document.createElement("li");
      item.textContent = snippet;
      list.appendChild(item);
    });
    group.appendChild(list);
    panel.appendChild(group);
  }
})();
