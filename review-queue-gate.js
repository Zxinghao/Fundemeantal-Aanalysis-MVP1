(function gateReviewQueue() {
  const policy = globalThis.ScannerEventPolicy;
  const originalBuildReviewQueue = globalThis.buildReviewQueue;

  if (!policy || typeof originalBuildReviewQueue !== "function") return;

  globalThis.buildReviewQueue = function buildActionableReviewQueue() {
    return originalBuildReviewQueue().filter((item) => {
      if (item?.origin !== "AI scan") return true;

      const scannerEventShape = {
        sourceType: "ai_scan",
        researchPacket: item.researchPacket || null,
        changeEvidence: item.changeEvidence || null
      };
      return policy.isActionableScannerEvent(scannerEventShape);
    });
  };
})();
