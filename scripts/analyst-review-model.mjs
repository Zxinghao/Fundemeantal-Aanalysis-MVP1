const confidenceLevels = new Set(["low", "medium", "high"]);
const patchModes = new Set(["none", "recent_update", "recent_catalyst", "score", "node_summary"]);
const scoreDimensions = new Set([
  "supplyChainImportance",
  "scarcity",
  "pricingPower",
  "switchingCost",
  "validationBarrier",
  "marketUnderappreciation"
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceIdsForItem(item) {
  const direct = Array.isArray(item?.sourceIds) ? item.sourceIds.filter(nonEmpty) : [];
  if (direct.length) return [...new Set(direct)];

  return [...new Set(
    (item?.researchPacket?.evidence || [])
      .map((evidence) => evidence?.sourceId)
      .filter(nonEmpty)
  )];
}

export function validateAnalystReview(item, review) {
  const errors = [];
  if (!item?.researchPacket) return errors;
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return ["Complete the Analyst Worksheet before approving this structured research event."];
  }

  if (review.primarySourceVerified !== true) {
    errors.push("Confirm that you opened and verified the primary source.");
  }
  if (!nonEmpty(review.analystFinding) || review.analystFinding.trim().length < 12) {
    errors.push("Write a specific verified fact / claim statement.");
  }
  if (!nonEmpty(review.analystRationale) || review.analystRationale.trim().length < 12) {
    errors.push("Explain why the evidence supports the claim.");
  }
  if (!confidenceLevels.has(review.confidence)) {
    errors.push("Choose a claim confidence level.");
  }
  if (!patchModes.has(review.patchMode)) {
    errors.push("Choose a final patch disposition.");
    return errors;
  }

  if (review.patchMode === "none") {
    if (!nonEmpty(review.noCanonicalChangeReason) || review.noCanonicalChangeReason.trim().length < 10) {
      errors.push("Explain why the verified claim does not require a canonical data change.");
    }
  }

  if (review.patchMode === "recent_update") {
    if (!item.companyId) errors.push("A company target is required for a recent-update patch.");
    if (!nonEmpty(review.patchValue) || review.patchValue.trim().length < 10) {
      errors.push("Provide the reviewed recent-update text.");
    }
  }

  if (review.patchMode === "recent_catalyst") {
    if (!item.companyId) errors.push("A company target is required for a recent-catalyst patch.");
    if (!nonEmpty(review.patchValue) || review.patchValue.trim().length < 10) {
      errors.push("Provide the reviewed recent-catalyst text.");
    }
  }

  if (review.patchMode === "node_summary") {
    if (!item.nodeId) errors.push("A node target is required for a node-summary patch.");
    if (!nonEmpty(review.patchValue) || review.patchValue.trim().length < 10) {
      errors.push("Provide the reviewed node-summary text.");
    }
  }

  if (review.patchMode === "score") {
    if (!item.companyId) errors.push("A company target is required for a score patch.");
    if (!scoreDimensions.has(review.scoreDimension)) errors.push("Choose a valid score dimension.");
    const score = Number(review.scoreValue);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      errors.push("Score must be a number between 0 and 100.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(review.evidenceDate || ""))) {
      errors.push("Score evidence date must use YYYY-MM-DD.");
    }
    if (!nonEmpty(review.scoreRationale) || review.scoreRationale.trim().length < 12) {
      errors.push("Provide a dimension-specific score rationale.");
    }
    if (sourceIdsForItem(item).length === 0) {
      errors.push("A score patch requires at least one linked source ID.");
    }
  }

  return errors;
}

function humanReviewRecord(review, status, reviewedAt) {
  const normalizedStatus = status === "approved"
    ? "verified"
    : status === "rejected"
      ? "rejected"
      : "needs_more_evidence";

  return {
    schemaVersion: "1.0",
    status: normalizedStatus,
    reviewerType: "human_analyst",
    primarySourceVerified: review?.primarySourceVerified === true,
    reviewedAt,
    finding: review?.analystFinding?.trim() || null,
    rationale: review?.analystRationale?.trim() || null,
    confidence: confidenceLevels.has(review?.confidence) ? review.confidence : "low",
    patchMode: patchModes.has(review?.patchMode) ? review.patchMode : null,
    noCanonicalChangeReason: review?.noCanonicalChangeReason?.trim() || null
  };
}

function buildOperations(item, packet, review) {
  const reason = review.analystRationale.trim();

  if (review.patchMode === "none") return [];

  if (review.patchMode === "recent_update") {
    return [{
      op: "append",
      path: `companies.${item.companyId}.recentUpdates`,
      value: review.patchValue.trim(),
      reason,
      requiresHumanInput: false
    }];
  }

  if (review.patchMode === "recent_catalyst") {
    return [{
      op: "replace",
      path: `companies.${item.companyId}.signals.recentCatalyst`,
      value: review.patchValue.trim(),
      reason,
      requiresHumanInput: false
    }];
  }

  if (review.patchMode === "node_summary") {
    return [{
      op: "replace",
      path: `nodes.${item.nodeId}.summary`,
      value: review.patchValue.trim(),
      reason,
      requiresHumanInput: false
    }];
  }

  if (review.patchMode === "score") {
    const score = Number(review.scoreValue);
    const sourceIds = sourceIdsForItem(item);
    const claimId = packet.claim?.id || `${item.id}-claim-1`;
    const provenance = {
      type: "reviewed_research_packet",
      eventId: item.id,
      claimId
    };
    const scoreEvidence = {
      score,
      rationale: review.scoreRationale.trim(),
      sourceIds,
      evidenceDate: review.evidenceDate,
      provenance
    };

    return [
      {
        op: "replace",
        path: `companies.${item.companyId}.scores.${review.scoreDimension}`,
        value: score,
        reason: review.scoreRationale.trim(),
        requiresHumanInput: false
      },
      {
        op: "replace",
        path: `companies.${item.companyId}.scoreEvidence.${review.scoreDimension}`,
        value: scoreEvidence,
        reason: "Attach the dimension-specific evidence trail for the reviewed score.",
        requiresHumanInput: false
      }
    ];
  }

  return [];
}

export function buildReviewedPacket(item, review, reviewStatus, { reviewedAt = new Date().toISOString() } = {}) {
  if (!item?.researchPacket) return null;
  const packet = clone(item.researchPacket);
  packet.humanReview = humanReviewRecord(review, reviewStatus, reviewedAt);

  if (reviewStatus === "rejected") {
    packet.claim.status = "rejected";
    packet.claim.confidence = packet.humanReview.confidence;
    if (packet.humanReview.finding) packet.claim.statement = packet.humanReview.finding;
    if (packet.humanReview.rationale) packet.claim.rationale = packet.humanReview.rationale;
    packet.proposedPatch = {
      status: "rejected",
      executable: false,
      operations: []
    };
    return packet;
  }

  if (reviewStatus === "needs_more_evidence") {
    packet.claim.status = "unverified";
    packet.claim.confidence = packet.humanReview.confidence;
    if (packet.humanReview.finding) packet.claim.statement = packet.humanReview.finding;
    if (packet.humanReview.rationale) packet.claim.rationale = packet.humanReview.rationale;
    packet.proposedPatch = {
      status: "draft",
      executable: false,
      operations: []
    };
    return packet;
  }

  if (reviewStatus !== "approved") return packet;

  const errors = validateAnalystReview(item, review);
  if (errors.length) throw new Error(errors.join(" "));

  packet.claim.status = "supported";
  packet.claim.statement = review.analystFinding.trim();
  packet.claim.rationale = review.analystRationale.trim();
  packet.claim.confidence = review.confidence;
  packet.claim.provenance = {
    type: "human_verified_research_packet",
    reviewedAt
  };

  const operations = buildOperations(item, packet, review);
  packet.proposedPatch = {
    status: "ready",
    executable: operations.length > 0,
    disposition: operations.length > 0 ? "canonical_change" : "no_canonical_change",
    operations
  };

  return packet;
}

export function validateApprovedPacketAuthority(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object") return ["Approved structured review is missing a research packet."];
  if (packet.claim?.status !== "supported") errors.push("Approved structured review requires claim.status=supported.");
  if (packet.humanReview?.status !== "verified") errors.push("Approved structured review requires a verified humanReview record.");
  if (packet.humanReview?.primarySourceVerified !== true) errors.push("Approved structured review requires primarySourceVerified=true.");
  if (!nonEmpty(packet.humanReview?.finding)) errors.push("Approved structured review requires a human finding.");
  if (!nonEmpty(packet.humanReview?.rationale)) errors.push("Approved structured review requires a human rationale.");
  if (!confidenceLevels.has(packet.humanReview?.confidence)) errors.push("Approved structured review requires a valid human confidence level.");

  if (packet.proposedPatch?.executable) {
    if (packet.proposedPatch?.status !== "ready") errors.push("Executable patch must be ready.");
    if (!Array.isArray(packet.proposedPatch?.operations) || packet.proposedPatch.operations.length === 0) {
      errors.push("Executable patch must contain operations.");
    }
  }

  return errors;
}
