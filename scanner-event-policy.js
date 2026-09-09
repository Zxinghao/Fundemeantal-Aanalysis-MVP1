(function attachScannerEventPolicy(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ScannerEventPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function scannerEventPolicyFactory() {
  function changeSetFor(event) {
    return event?.researchPacket?.evidence?.[0]?.changeSet || event?.changeEvidence || null;
  }

  function changedContextCount(changeSet) {
    return Number(changeSet?.addedCount || 0) + Number(changeSet?.removedCount || 0);
  }

  function classifyScannerEvent(event) {
    if (!event || event.sourceType !== "ai_scan") {
      return {
        actionable: true,
        category: "not_scanner_event",
        reason: "This policy only gates AI scanner events."
      };
    }

    const changeSet = changeSetFor(event);

    if (!changeSet) {
      return {
        actionable: false,
        category: "legacy_unverifiable",
        reason: "Legacy scanner event has no comparable watched-context change evidence."
      };
    }

    if (changeSet.status === "baseline_missing") {
      return {
        actionable: false,
        category: "operational_baseline",
        reason: "Baseline establishment is operational history, not a reviewable disclosure."
      };
    }

    if (changeSet.status !== "comparable") {
      return {
        actionable: false,
        category: "not_comparable",
        reason: `Scanner event is not comparable (${changeSet.status || "unknown"}).`
      };
    }

    if (changedContextCount(changeSet) <= 0) {
      return {
        actionable: false,
        category: "no_relevant_diff",
        reason: "Comparable event has no added or removed watched-context window."
      };
    }

    return {
      actionable: true,
      category: "comparable_disclosure_change",
      reason: "Comparable watched-context disclosure change is ready for analyst review."
    };
  }

  function isActionableScannerEvent(event) {
    return classifyScannerEvent(event).actionable;
  }

  function summarizeScannerEvents(events, industryId = null) {
    const relevant = (Array.isArray(events) ? events : [])
      .filter((event) => event?.sourceType === "ai_scan")
      .filter((event) => !industryId || event.industryId === industryId);

    const summary = {
      total: relevant.length,
      actionable: 0,
      suppressed: 0,
      categories: {}
    };

    relevant.forEach((event) => {
      const classification = classifyScannerEvent(event);
      if (classification.actionable) summary.actionable += 1;
      else summary.suppressed += 1;
      summary.categories[classification.category] = (summary.categories[classification.category] || 0) + 1;
    });

    return summary;
  }

  return {
    changeSetFor,
    classifyScannerEvent,
    isActionableScannerEvent,
    summarizeScannerEvents
  };
});
