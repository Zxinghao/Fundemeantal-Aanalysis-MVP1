const candidateStatuses = new Set(["candidate", "verified", "rejected"]);
const interpretationConfidence = new Set(["low", "medium", "high"]);
const scoreImpactStatuses = new Set(["not_assessed", "review_required", "supported"]);

const scoreDimensions = new Set([
  "supplyChainImportance",
  "scarcity",
  "pricingPower",
  "switchingCost",
  "validationBarrier",
  "marketUnderappreciation"
]);

const reviewDimensionsByImpact = {
  supply_chain_importance: ["supplyChainImportance"],
  bottleneck_judgement: ["scarcity", "switchingCost", "validationBarrier"],
  financial_update: ["pricingPower", "marketUnderappreciation"],
  new_player: ["scarcity", "supplyChainImportance"],
  relationship_change: ["scarcity", "supplyChainImportance"],
  capacity_change: ["supplyChainImportance", "scarcity"],
  technology_change: ["validationBarrier", "switchingCost"],
  policy_change: ["supplyChainImportance", "marketUnderappreciation"]
};

const quantityPattern = /(?:\b\d{1,3}(?:[,. ]\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b)\s?(?:%|million|billion|thousand|bn|mn|mw|gw|gwh|mwh|kw|kg|kt|mt|tons?|tonnes?|units?|systems?|vehicles?|bar|gbps|tbps)?/gi;

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeQuantity(value) {
  return normalizeSpace(value).toLowerCase().replace(/,(?=\d{3}\b)/g, "");
}

function extractQuantities(text) {
  const matches = normalizeSpace(text).match(quantityPattern) || [];
  return [...new Set(matches.map((value) => normalizeSpace(value)).filter(Boolean))].slice(0, 8);
}

function sharedKeywordCount(before, after, keywords) {
  const beforeLower = String(before || "").toLowerCase();
  const afterLower = String(after || "").toLowerCase();
  return (keywords || []).filter((keyword) => {
    const needle = String(keyword || "").toLowerCase();
    return needle && beforeLower.includes(needle) && afterLower.includes(needle);
  }).length;
}

function bestSnippetPair(removed, added, keywords) {
  let best = null;
  for (const before of removed || []) {
    for (const after of added || []) {
      const score = sharedKeywordCount(before, after, keywords);
      if (!best || score > best.score) best = { before, after, score };
    }
  }
  return best;
}

function numericChangeCandidate(pair) {
  if (!pair) return null;
  const beforeValues = extractQuantities(pair.before);
  const afterValues = extractQuantities(pair.after);
  if (!beforeValues.length || !afterValues.length) return null;

  for (const before of beforeValues) {
    for (const after of afterValues) {
      if (normalizeQuantity(before) !== normalizeQuantity(after)) {
        return {
          before,
          after,
          statement: `Possible numeric disclosure change in watched context: ${before} → ${after}.`
        };
      }
    }
  }
  return null;
}

function targetFor(source) {
  if (source?.companyId) return `company:${source.companyId}`;
  return `node:${source?.nodeId || source?.id || "unknown"}`;
}

function candidateInterpretationStatement({ source, impactType, numericChange }) {
  const target = targetFor(source);
  const label = String(impactType || "research").replaceAll("_", " ");
  if (numericChange) {
    return `Potential ${label} disclosure change for ${target}; a numeric value changed in keyword-focused context and requires primary-source verification.`;
  }
  return `Potential ${label} disclosure change for ${target}; watched context changed and requires primary-source verification.`;
}

export function buildSemanticCandidate({ source, hits = [], impactType, changeEvidence, detectedAt }) {
  const comparable = changeEvidence?.status === "comparable";
  const added = comparable && Array.isArray(changeEvidence?.added) ? changeEvidence.added : [];
  const removed = comparable && Array.isArray(changeEvidence?.removed) ? changeEvidence.removed : [];
  const pair = bestSnippetPair(removed, added, hits);
  const numericChange = numericChangeCandidate(pair);
  const observedFacts = [];

  if (pair) {
    observedFacts.push({
      id: "fact-context-change-1",
      type: "watched_context_change",
      status: "candidate",
      beforeExcerpt: pair.before,
      afterExcerpt: pair.after,
      matchedKeywords: hits,
      statement: "A keyword-focused source context changed between the previous and current snapshots.",
      requiresPrimarySourceVerification: true
    });
  }

  if (numericChange) {
    observedFacts.push({
      id: "fact-numeric-change-1",
      type: "numeric_change_candidate",
      status: "candidate",
      beforeExcerpt: pair.before,
      afterExcerpt: pair.after,
      beforeValue: numericChange.before,
      afterValue: numericChange.after,
      matchedKeywords: hits,
      statement: numericChange.statement,
      requiresPrimarySourceVerification: true
    });
  }

  const candidateDimensions = [...(reviewDimensionsByImpact[impactType] || [])];
  const hasComparableChange = added.length + removed.length > 0;

  return {
    schemaVersion: "1.0",
    status: "candidate",
    generator: {
      type: "deterministic_heuristic",
      version: "1.0"
    },
    createdAt: detectedAt || null,
    target: targetFor(source),
    observedFacts,
    interpretation: {
      status: "candidate",
      type: impactType || "supply_chain_importance",
      statement: candidateInterpretationStatement({ source, impactType, numericChange }),
      confidence: numericChange && pair?.score > 0 ? "medium" : hasComparableChange ? "low" : "low",
      rationale: numericChange
        ? "The same keyword-focused context contains a changed numeric token. This is a review lead, not proof that the number has the same business meaning in both excerpts."
        : hasComparableChange
          ? "Keyword-focused context changed, but no reliable numeric before/after candidate was isolated."
          : "No comparable changed watched context is available for semantic interpretation.",
      requiresPrimarySourceVerification: true
    },
    scoreImpact: {
      status: candidateDimensions.length ? "review_required" : "not_assessed",
      candidateDimensions,
      direction: null,
      proposedScores: {},
      reason: candidateDimensions.length
        ? "These rubric dimensions may be relevant to the event type, but no direction or score change is proposed before the disclosure is verified."
        : "No score dimension is proposed from the current candidate interpretation."
    }
  };
}

export function validateSemanticCandidate(candidate) {
  const errors = [];
  if (!candidate || candidate.schemaVersion !== "1.0") {
    return ["semanticCandidate.schemaVersion must be 1.0."];
  }
  if (!candidateStatuses.has(candidate.status)) {
    errors.push(`Invalid semanticCandidate status: ${candidate.status}.`);
  }
  if (candidate.generator?.type !== "deterministic_heuristic" && candidate.generator?.type !== "llm_research_agent" && candidate.generator?.type !== "manual_research") {
    errors.push("semanticCandidate.generator.type must be deterministic_heuristic, llm_research_agent, or manual_research.");
  }
  if (!candidate.target) errors.push("semanticCandidate.target is required.");
  if (!Array.isArray(candidate.observedFacts)) {
    errors.push("semanticCandidate.observedFacts must be an array.");
  } else {
    for (const fact of candidate.observedFacts) {
      if (!fact?.id || !fact?.type || !candidateStatuses.has(fact?.status)) {
        errors.push("Each semantic candidate fact must include id, type, and a valid status.");
      }
      if (!fact?.statement) errors.push("Each semantic candidate fact must include a statement.");
      if (fact?.status === "candidate" && fact?.requiresPrimarySourceVerification !== true) {
        errors.push("Candidate semantic facts must require primary-source verification.");
      }
    }
  }

  const interpretation = candidate.interpretation;
  if (!interpretation?.statement || !candidateStatuses.has(interpretation?.status)) {
    errors.push("semanticCandidate.interpretation must include statement and valid status.");
  }
  if (!interpretationConfidence.has(interpretation?.confidence)) {
    errors.push("semanticCandidate.interpretation.confidence must be low, medium, or high.");
  }
  if (interpretation?.status === "candidate" && interpretation?.requiresPrimarySourceVerification !== true) {
    errors.push("Candidate interpretation must require primary-source verification.");
  }

  const scoreImpact = candidate.scoreImpact;
  if (!scoreImpactStatuses.has(scoreImpact?.status)) {
    errors.push("semanticCandidate.scoreImpact.status must be not_assessed, review_required, or supported.");
  }
  if (!Array.isArray(scoreImpact?.candidateDimensions) || scoreImpact.candidateDimensions.some((dimension) => !scoreDimensions.has(dimension))) {
    errors.push("semanticCandidate.scoreImpact.candidateDimensions contains an invalid score dimension.");
  }
  if (scoreImpact?.status !== "supported") {
    if (scoreImpact?.direction !== null) errors.push("Unverified semantic score impact cannot set a direction.");
    if (Object.keys(scoreImpact?.proposedScores || {}).length > 0) errors.push("Unverified semantic score impact cannot propose numeric scores.");
  }

  return errors;
}
