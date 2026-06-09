const exportReview = document.querySelector("#export-review");
const exportStatus = document.querySelector("#export-status");

function exportReviewDecisions() {
  const decisions = loadReviewDecisions();
  const reviewedItems = buildReviewQueue()
    .filter((item) => decisions[item.id] && decisions[item.id] !== "pending")
    .map((item) => ({
      id: item.id,
      industryId: state.industry.id,
      industryName: state.industry.name,
      companyId: item.companyId || null,
      nodeId: item.nodeId || null,
      company: item.company,
      impact: item.impact,
      origin: item.origin,
      source: item.source,
      sourceIds: item.sourceIds,
      analysis: item.analysis || null,
      summary: item.summary,
      reviewStatus: decisions[item.id]
    }));

  if (reviewedItems.length === 0) {
    exportStatus.textContent = "There are no review decisions to export yet.";
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    industryId: state.industry.id,
    industryName: state.industry.name,
    reviewedItems
  };

  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `review-decisions-${state.industry.id}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  renderReviewPayload(text, reviewedItems.length);
}

function renderReviewPayload(text, count) {
  let output = document.querySelector("#review-json-output");
  if (!output) {
    output = document.createElement("textarea");
    output.id = "review-json-output";
    output.readOnly = true;
    output.rows = 8;
    exportStatus.insertAdjacentElement("afterend", output);
  }

  output.value = text;
  output.select();

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  exportStatus.textContent = `Exported ${count} review decision(s). The JSON is shown below and can be pasted into the Approve And Promote workflow.`;
}

exportReview.addEventListener("click", exportReviewDecisions);
