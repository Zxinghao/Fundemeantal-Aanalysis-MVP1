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
      company: item.company,
      impact: item.impact,
      origin: item.origin,
      source: item.source,
      sourceIds: item.sourceIds,
      summary: item.summary,
      reviewStatus: decisions[item.id]
    }));

  if (reviewedItems.length === 0) {
    exportStatus.textContent = "当前还没有可导出的审核决定。";
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    industryId: state.industry.id,
    industryName: state.industry.name,
    reviewedItems
  };

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `review-decisions-${state.industry.id}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  exportStatus.textContent = `已导出 ${reviewedItems.length} 条审核决定。`;
}

exportReview.addEventListener("click", exportReviewDecisions);
