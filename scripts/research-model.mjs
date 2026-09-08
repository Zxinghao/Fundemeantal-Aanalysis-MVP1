const scoreDimensions = new Set([
  "supplyChainImportance",
  "scarcity",
  "pricingPower",
  "switchingCost",
  "validationBarrier",
  "marketUnderappreciation"
]);

const signalFields = new Set([
  "importantSupplier",
  "bottleneckPosition",
  "playerConcentration",
  "recentCatalyst"
]);

const claimStatuses = new Set(["unverified", "supported", "rejected", "superseded"]);
const confidenceLevels = new Set(["low", "medium", "high"]);
const patchStatuses = new Set(["draft", "ready", "applied", "rejected"]);
const evidenceLevels = new Set(["A", "B", "C"]);

const impactLabels = {
  supply_chain_importance: "supply-chain importance",
  bottleneck_judgement: "bottleneck",
  financial_update: "financial or order",
  new_player: "new-player",
  relationship_change: "relationship",
  capacity_change: "capacity",
  technology_change: "technology",
  policy_change: "policy"
};

export function computeCompositeScore(scores, rubric) {
  const dimensions = rubric?.dimensions || {};
  let weighted = 0;
  let totalWeight = 0;

  for (const [dimension, config] of Object.entries(dimensions)) {
    const value = scores?.[dimension];
    const weight = Number(config?.weight);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight < 0) continue;
    weighted += value * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return null;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

export function classifyComposite(score, rubric) {
  if (!Number.isFinite(score)) return null;
  const classifications = [...(rubric?.classifications || [])]
    .filter((entry) => Number.isFinite(entry?.min) && entry?.label)
    .sort((a, b) => b.min - a.min);
  return classifications.find((entry) => score >= entry.min)?.label || null;
}

export function buildResearchPacket({
  eventId,
  source,
  title,
  hits,
  impactType,
  detectedAt
}) {
  const matchedKeywords = Array.isArray(hits) ? hits : [];
  const evidenceLevel = evidenceLevelForSourceType(source.sourceType);
  const target = source.companyId
    ? `company:${source.companyId}`
    : `node:${source.nodeId || source.id}`;
  const confidence = evidenceLevel === "A" && matchedKeywords.length >= 2 ? "medium" : "low";
  const impactLabel = impactLabels[impactType] || impactType || "research";

  return {
    schemaVersion: "1.0",
    evidence: [
      {
        id: `${eventId}-evidence-1`,
        sourceId: source.id,
        sourceType: source.sourceType || "unknown",
        url: source.url || null,
        pageTitle: title || null,
        observedAt: detectedAt,
        evidenceLevel,
        matchedKeywords,
        observation: matchedKeywords.length
          ? `The watched page fingerprint changed and the current page contains: ${matchedKeywords.join(", ")}.`
          : "The watched page fingerprint changed, but no configured watch keyword was found on the current page.",
        limitation: "The deterministic scanner does not identify the exact changed sentence. Open the primary source and verify the disclosure before approving an investment claim."
      }
    ],
    claim: {
      id: `${eventId}-claim-1`,
      status: "unverified",
      type: impactType || "supply_chain_importance",
      target,
      statement: `Potential ${impactLabel} change affecting ${target}; exact materiality is not yet verified.`,
      confidence,
      rationale: matchedKeywords.length >= 2
        ? "Multiple watched terms are present on a changed primary/monitored page, which raises review priority but does not prove a thesis change."
        : "A source-page change alone is insufficient to infer a material thesis change."
    },
    proposedPatch: {
      status: "draft",
      executable: false,
      operations: [
        {
          op: "review",
          path: source.companyId
            ? `companies.${source.companyId}.recentUpdates`
            : `nodes.${source.nodeId || source.id}.summary`,
          value: null,
          reason: "Replace this review placeholder with an evidence-specific operation only after the exact disclosure is verified.",
          requiresHumanInput: true
        }
      ]
    }
  };
}

export function evidenceLevelForSourceType(sourceType) {
  const levels = {
    company_official: "A",
    government: "A",
    exchange_filing: "A",
    industry_media: "B",
    media: "B",
    placeholder: "C"
  };
  return levels[sourceType] || "B";
}

export function validateResearchPacket(packet) {
  const errors = [];
  if (!packet || packet.schemaVersion !== "1.0") {
    errors.push("researchPacket.schemaVersion must be 1.0.");
    return errors;
  }

  if (!Array.isArray(packet.evidence) || packet.evidence.length === 0) {
    errors.push("researchPacket.evidence must contain at least one evidence item.");
  } else {
    for (const evidence of packet.evidence) {
      if (!evidence?.sourceId || !evidence?.observation) {
        errors.push("Each evidence item must include sourceId and observation.");
      }
      if (!evidenceLevels.has(evidence?.evidenceLevel)) {
        errors.push("Each evidence item must use evidenceLevel A, B, or C.");
      }
    }
  }

  if (!packet.claim?.statement || !packet.claim?.status || !packet.claim?.target) {
    errors.push("researchPacket.claim must include statement, status, and target.");
  } else {
    if (!claimStatuses.has(packet.claim.status)) errors.push(`Invalid claim status: ${packet.claim.status}.`);
    if (!confidenceLevels.has(packet.claim.confidence)) errors.push(`Invalid claim confidence: ${packet.claim.confidence}.`);
  }

  if (!packet.proposedPatch || !Array.isArray(packet.proposedPatch.operations)) {
    errors.push("researchPacket.proposedPatch.operations must be an array.");
    return errors;
  }

  if (!patchStatuses.has(packet.proposedPatch.status)) {
    errors.push(`Invalid proposedPatch status: ${packet.proposedPatch.status}.`);
  }

  if (packet.proposedPatch.executable) {
    if (packet.proposedPatch.status !== "ready") {
      errors.push("An executable proposedPatch must have status=ready.");
    }
    if (packet.claim?.status !== "supported") {
      errors.push("An executable proposedPatch requires claim.status=supported.");
    }
    if (packet.proposedPatch.operations.length === 0) {
      errors.push("An executable proposedPatch must contain at least one operation.");
    }
    if (packet.proposedPatch.operations.some((operation) => operation?.requiresHumanInput)) {
      errors.push("An executable proposedPatch cannot contain operations that still require human input.");
    }
  }

  return errors;
}

export function applyApprovedPatch(industry, packet) {
  const operations = packet?.proposedPatch?.operations || [];
  if (!packet?.proposedPatch?.executable || packet.proposedPatch.status !== "ready" || packet?.claim?.status !== "supported") {
    return { applied: [], skipped: operations.map((operation) => operation.path) };
  }

  // Preflight the entire patch before mutating anything. A research patch is atomic:
  // one invalid operation rejects the whole group rather than leaving reviewed data
  // in a partially updated state.
  if (operations.length === 0 || operations.some((operation) => !canApplyPatchOperation(industry, operation))) {
    return { applied: [], skipped: operations.map((operation) => operation.path) };
  }

  for (const operation of operations) applyPatchOperation(industry, operation);
  return { applied: operations.map((operation) => operation.path), skipped: [] };
}

function canApplyPatchOperation(industry, operation) {
  if (!operation || operation.requiresHumanInput) return false;
  const parts = String(operation.path || "").split(".");
  if (parts.length < 3) return false;

  if (parts[0] === "companies") {
    const company = (industry.companies || []).find((candidate) => candidate.id === parts[1]);
    if (!company) return false;

    if (parts[2] === "recentUpdates") {
      return parts.length === 3 && operation.op === "append" && typeof operation.value === "string" && operation.value.trim().length > 0;
    }

    if (parts[2] === "signals") {
      return parts.length === 4
        && signalFields.has(parts[3])
        && operation.op === "replace"
        && typeof operation.value === "string"
        && operation.value.trim().length > 0;
    }

    if (parts[2] === "scores") {
      const value = Number(operation.value);
      return parts.length === 4
        && scoreDimensions.has(parts[3])
        && operation.op === "replace"
        && Number.isFinite(value)
        && value >= 0
        && value <= 100;
    }

    return false;
  }

  if (parts[0] === "nodes") {
    const node = (industry.nodes || []).find((candidate) => candidate.id === parts[1]);
    return Boolean(node)
      && parts.length === 3
      && parts[2] === "summary"
      && operation.op === "replace"
      && typeof operation.value === "string"
      && operation.value.trim().length > 0;
  }

  return false;
}

function applyPatchOperation(industry, operation) {
  const parts = String(operation.path).split(".");

  if (parts[0] === "companies") {
    const company = industry.companies.find((candidate) => candidate.id === parts[1]);

    if (parts[2] === "recentUpdates") {
      company.recentUpdates ||= [];
      if (!company.recentUpdates.includes(operation.value)) company.recentUpdates.unshift(operation.value);
      return;
    }

    if (parts[2] === "signals") {
      company.signals ||= {};
      company.signals[parts[3]] = operation.value;
      return;
    }

    if (parts[2] === "scores") {
      company.scores ||= {};
      company.scores[parts[3]] = Number(operation.value);
      return;
    }
  }

  if (parts[0] === "nodes") {
    const node = industry.nodes.find((candidate) => candidate.id === parts[1]);
    node.summary = operation.value;
  }
}
