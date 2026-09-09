import {
  buildPatchPreview,
  buildReviewedPacket,
  validateAnalystReview
} from "./scripts/analyst-review-model.mjs";

const STORAGE_KEY = "analystReviews";
const scoreDimensionLabels = {
  supplyChainImportance: "Supply chain importance",
  scarcity: "Scarcity",
  pricingPower: "Pricing power",
  switchingCost: "Switching cost",
  validationBarrier: "Validation barrier",
  marketUnderappreciation: "Market underappreciation"
};

let canonicalIndustries = [];
let canonicalDataStatus = "loading";

const canonicalDataPromise = fetch("data/industries.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Canonical industry data failed to load: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) throw new Error("Canonical industry data is malformed.");
    canonicalIndustries = data;
    canonicalDataStatus = "ready";
    refreshAllPreviews();
  })
  .catch(() => {
    canonicalDataStatus = "error";
    refreshAllPreviews();
  });

function loadAllReviews() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function getReview(id) {
  return loadAllReviews()[id] || null;
}

function saveReview(id, review) {
  const all = loadAllReviews();
  all[id] = {
    ...review,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all[id];
}

function currentItem(id) {
  if (typeof window.buildReviewQueue !== "function") return null;
  return window.buildReviewQueue().find((item) => item.id === id) || null;
}

function canonicalIndustryFor(item) {
  if (item?.industryId) {
    const explicit = canonicalIndustries.find((industry) => industry.id === item.industryId);
    if (explicit) return explicit;
  }

  const matches = canonicalIndustries.filter((industry) => {
    const companyMatches = !item?.companyId
      || (industry.companies || []).some((company) => company.id === item.companyId);
    const nodeMatches = !item?.nodeId
      || (industry.nodes || []).some((node) => node.id === item.nodeId);
    return companyMatches && nodeMatches;
  });

  return matches.length === 1 ? matches[0] : null;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function seedCandidate(item) {
  const candidate = item?.researchPacket?.llmCandidate || item?.researchPacket?.semanticCandidate || null;
  if (!candidate) return null;
  return {
    finding: text(candidate.interpretation?.statement),
    rationale: text(candidate.interpretation?.rationale)
  };
}

function patchModeOptions(item) {
  const options = [
    ["none", "Verified claim, no canonical data change"]
  ];

  if (item.companyId) {
    options.push(
      ["recent_update", "Append reviewed company update"],
      ["recent_catalyst", "Replace company recent catalyst"],
      ["score", "Update one score + score evidence"]
    );
  }
  if (item.nodeId) options.push(["node_summary", "Replace node summary"]);
  return options;
}

function createField(labelText, input) {
  const label = document.createElement("label");
  label.className = "analyst-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, input);
  return label;
}

function inputElement(name, value = "", type = "text") {
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = value ?? "";
  return input;
}

function textareaElement(name, value = "", rows = 3) {
  const textarea = document.createElement("textarea");
  textarea.name = name;
  textarea.rows = rows;
  textarea.value = value ?? "";
  return textarea;
}

function selectElement(name, options, selected) {
  const select = document.createElement("select");
  select.name = name;
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selected;
    select.appendChild(option);
  }
  return select;
}

function buildPreviewShell() {
  const section = document.createElement("section");
  section.className = "final-patch-preview";

  const heading = document.createElement("div");
  heading.className = "patch-preview-heading";
  const title = document.createElement("strong");
  title.textContent = "Final Patch Preview";
  const badge = document.createElement("span");
  badge.className = "patch-preview-badge";
  heading.append(title, badge);

  const intro = document.createElement("p");
  intro.className = "patch-preview-intro";
  intro.textContent = "This is generated from the same canonical-operation builder used by the exported approved research packet.";

  const body = document.createElement("div");
  body.className = "patch-preview-body";

  section.append(heading, intro, body);
  return section;
}

function buildWorksheet(item) {
  const saved = getReview(item.id) || {};
  const details = document.createElement("details");
  details.className = "analyst-workbench";
  details.dataset.analystReviewId = item.id;

  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.textContent = "Analyst Worksheet";
  const badge = document.createElement("strong");
  badge.className = "analyst-readiness";
  summary.append(title, badge);
  details.appendChild(summary);

  const form = document.createElement("div");
  form.className = "analyst-form";

  const intro = document.createElement("p");
  intro.className = "analyst-intro";
  intro.textContent = "LLM and deterministic outputs are drafts only. Verify the primary source, write the human finding, then choose the exact canonical patch disposition.";
  form.appendChild(intro);

  const verifiedLabel = document.createElement("label");
  verifiedLabel.className = "analyst-check";
  const verified = inputElement("primarySourceVerified", "", "checkbox");
  verified.checked = saved.primarySourceVerified === true;
  const verifiedText = document.createElement("span");
  verifiedText.textContent = "I opened the primary source and verified the relevant disclosure in context.";
  verifiedLabel.append(verified, verifiedText);
  form.appendChild(verifiedLabel);

  form.appendChild(createField(
    "Verified fact / claim",
    textareaElement("analystFinding", saved.analystFinding || "", 3)
  ));
  form.appendChild(createField(
    "Why the evidence supports this claim",
    textareaElement("analystRationale", saved.analystRationale || "", 3)
  ));
  form.appendChild(createField(
    "Human confidence",
    selectElement("confidence", [
      ["low", "Low"],
      ["medium", "Medium"],
      ["high", "High"]
    ], saved.confidence || "medium")
  ));

  const patchSelect = selectElement("patchMode", patchModeOptions(item), saved.patchMode || "none");
  form.appendChild(createField("Final patch disposition", patchSelect));

  const patchValue = createField(
    "Reviewed replacement / update text",
    textareaElement("patchValue", saved.patchValue || "", 3)
  );
  patchValue.dataset.patchField = "text";
  form.appendChild(patchValue);

  const noChange = createField(
    "Why no canonical change is required",
    textareaElement("noCanonicalChangeReason", saved.noCanonicalChangeReason || "", 2)
  );
  noChange.dataset.patchField = "none";
  form.appendChild(noChange);

  const dimension = selectElement(
    "scoreDimension",
    Object.entries(scoreDimensionLabels),
    saved.scoreDimension || "supplyChainImportance"
  );
  const dimensionField = createField("Score dimension", dimension);
  dimensionField.dataset.patchField = "score";
  form.appendChild(dimensionField);

  const scoreValueField = createField(
    "Reviewed score (0–100)",
    inputElement("scoreValue", saved.scoreValue ?? "", "number")
  );
  scoreValueField.dataset.patchField = "score";
  scoreValueField.querySelector("input").min = "0";
  scoreValueField.querySelector("input").max = "100";
  scoreValueField.querySelector("input").step = "1";
  form.appendChild(scoreValueField);

  const today = new Date().toISOString().slice(0, 10);
  const evidenceDateField = createField(
    "Score evidence date",
    inputElement("evidenceDate", saved.evidenceDate || today, "date")
  );
  evidenceDateField.dataset.patchField = "score";
  form.appendChild(evidenceDateField);

  const scoreRationaleField = createField(
    "Dimension-specific score rationale",
    textareaElement("scoreRationale", saved.scoreRationale || "", 3)
  );
  scoreRationaleField.dataset.patchField = "score";
  form.appendChild(scoreRationaleField);

  form.appendChild(buildPreviewShell());

  const actions = document.createElement("div");
  actions.className = "analyst-actions";
  const seed = document.createElement("button");
  seed.type = "button";
  seed.dataset.analystSeed = item.id;
  seed.textContent = "Use AI candidate as draft";
  seed.disabled = !seedCandidate(item);
  const save = document.createElement("button");
  save.type = "button";
  save.dataset.analystSave = item.id;
  save.textContent = "Save Analyst Worksheet";
  actions.append(seed, save);
  form.appendChild(actions);

  const status = document.createElement("div");
  status.className = "analyst-status";
  status.setAttribute("role", "status");
  form.appendChild(status);

  details.appendChild(form);
  updatePatchFields(details);
  updateReadiness(details, item);
  updatePatchPreview(details, item);
  return details;
}

function reviewFromWorksheet(details) {
  const field = (name) => details.querySelector(`[name="${name}"]`);
  return {
    primarySourceVerified: Boolean(field("primarySourceVerified")?.checked),
    analystFinding: field("analystFinding")?.value?.trim() || "",
    analystRationale: field("analystRationale")?.value?.trim() || "",
    confidence: field("confidence")?.value || "medium",
    patchMode: field("patchMode")?.value || "none",
    patchValue: field("patchValue")?.value?.trim() || "",
    noCanonicalChangeReason: field("noCanonicalChangeReason")?.value?.trim() || "",
    scoreDimension: field("scoreDimension")?.value || "supplyChainImportance",
    scoreValue: field("scoreValue")?.value || "",
    evidenceDate: field("evidenceDate")?.value || "",
    scoreRationale: field("scoreRationale")?.value?.trim() || ""
  };
}

function updatePatchFields(details) {
  const mode = details.querySelector('[name="patchMode"]')?.value || "none";
  details.querySelectorAll("[data-patch-field]").forEach((field) => {
    const kind = field.dataset.patchField;
    const visible = kind === mode
      || (kind === "text" && ["recent_update", "recent_catalyst", "node_summary"].includes(mode));
    field.hidden = !visible;
  });
}

function approvalErrors(item, review) {
  const errors = validateAnalystReview(item, review);
  if (errors.length) return errors;
  if (canonicalDataStatus === "loading") return ["Wait for canonical industry data to finish loading before approval."];
  if (canonicalDataStatus === "error") return ["Canonical industry data could not be loaded for patch preflight."];

  const preview = buildPatchPreview(item, review, canonicalIndustryFor(item));
  return preview.errors || [];
}

function updateReadiness(details, item, explicitReview = null) {
  const review = explicitReview || getReview(item.id);
  const errors = approvalErrors(item, review);
  const badge = details.querySelector(".analyst-readiness");
  if (!badge) return errors;
  badge.textContent = errors.length ? "Approval locked" : "Ready to approve";
  badge.classList.toggle("ready", errors.length === 0);
  return errors;
}

function showStatus(details, message, kind = "") {
  const status = details.querySelector(".analyst-status");
  if (!status) return;
  status.textContent = message;
  status.className = `analyst-status ${kind}`.trim();
}

function formatPreviewValue(value) {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function labeledValue(labelText, value, className = "") {
  const wrap = document.createElement("div");
  wrap.className = `patch-preview-value ${className}`.trim();
  const label = document.createElement("span");
  label.textContent = labelText;
  const pre = document.createElement("pre");
  pre.textContent = formatPreviewValue(value);
  wrap.append(label, pre);
  return wrap;
}

function renderPatchPreviewBody(section, preview) {
  const badge = section.querySelector(".patch-preview-badge");
  const body = section.querySelector(".patch-preview-body");
  body.replaceChildren();
  badge.classList.remove("ready");

  if (preview.status === "loading") {
    badge.textContent = "Loading";
    const note = document.createElement("p");
    note.textContent = "Loading canonical values for preflight comparison…";
    body.appendChild(note);
    return;
  }

  if (preview.status === "blocked") {
    badge.textContent = "Blocked";
    const list = document.createElement("ul");
    for (const error of preview.errors || []) {
      const item = document.createElement("li");
      item.textContent = error;
      list.appendChild(item);
    }
    body.appendChild(list);
    return;
  }

  badge.textContent = preview.executable ? "Canonical change" : "No canonical change";
  badge.classList.add("ready");

  const sourceLine = document.createElement("small");
  sourceLine.className = "patch-preview-sources";
  sourceLine.textContent = `Linked source IDs: ${(preview.sourceIds || []).join(", ") || "none"}`;
  body.appendChild(sourceLine);

  if (!preview.executable) {
    const note = document.createElement("p");
    note.className = "patch-preview-no-change";
    note.textContent = preview.noCanonicalChangeReason || "Verified claim will be recorded without modifying canonical fields.";
    body.appendChild(note);
    return;
  }

  for (const operation of preview.operations || []) {
    const card = document.createElement("article");
    card.className = `patch-preview-operation ${operation.wouldChange ? "will-change" : "no-op"}`;

    const header = document.createElement("div");
    header.className = "patch-preview-operation-heading";
    const op = document.createElement("strong");
    op.textContent = operation.op.toUpperCase();
    const path = document.createElement("code");
    path.textContent = operation.path;
    const effect = document.createElement("span");
    effect.textContent = operation.wouldChange ? "Will change canonical data" : "Idempotent / current value already matches";
    header.append(op, path, effect);

    const values = document.createElement("div");
    values.className = "patch-preview-values";
    values.append(
      labeledValue(operation.op === "append" ? "Current canonical collection" : "Current canonical value", operation.currentValue, "current"),
      labeledValue(operation.op === "append" ? "Value to append" : "Proposed canonical value", operation.proposedValue, "proposed")
    );

    const reason = document.createElement("small");
    reason.className = "patch-preview-reason";
    reason.textContent = `Reason: ${operation.reason || "No reason recorded."}`;

    card.append(header, values, reason);
    body.appendChild(card);
  }
}

function updatePatchPreview(details, item) {
  const section = details.querySelector(".final-patch-preview");
  if (!section || !item) return;

  if (canonicalDataStatus === "loading") {
    renderPatchPreviewBody(section, { status: "loading" });
    return;
  }

  if (canonicalDataStatus === "error") {
    renderPatchPreviewBody(section, {
      status: "blocked",
      errors: ["Canonical industry data could not be loaded, so exact patch preflight is unavailable."]
    });
    return;
  }

  const review = reviewFromWorksheet(details);
  const preview = buildPatchPreview(item, review, canonicalIndustryFor(item));
  renderPatchPreviewBody(section, preview);
}

function refreshAllPreviews() {
  document.querySelectorAll(".analyst-workbench").forEach((details) => {
    const item = currentItem(details.dataset.analystReviewId);
    if (!item) return;
    updatePatchPreview(details, item);
    updateReadiness(details, item);
  });
}

function enhanceCards() {
  document.querySelectorAll("#pending-updates .update-card").forEach((card) => {
    if (card.querySelector(".analyst-workbench")) return;
    const id = card.querySelector("[data-review-id]")?.dataset.reviewId;
    if (!id) return;
    const item = currentItem(id);
    if (!item?.researchPacket) return;
    const actions = card.querySelector(".review-actions");
    const worksheet = buildWorksheet(item);
    if (actions) actions.insertAdjacentElement("beforebegin", worksheet);
    else card.appendChild(worksheet);
  });
}

function handleSeed(button) {
  const id = button.dataset.analystSeed;
  const item = currentItem(id);
  const draft = seedCandidate(item);
  const details = button.closest(".analyst-workbench");
  if (!details || !draft) return;
  const finding = details.querySelector('[name="analystFinding"]');
  const rationale = details.querySelector('[name="analystRationale"]');
  if (finding && !finding.value.trim()) finding.value = draft.finding;
  if (rationale && !rationale.value.trim()) rationale.value = draft.rationale;
  updatePatchPreview(details, item);
  showStatus(details, "AI text copied as an editable draft. It is still unverified until you check the primary source.");
}

function handleSave(button) {
  const id = button.dataset.analystSave;
  const item = currentItem(id);
  const details = button.closest(".analyst-workbench");
  if (!item || !details) return;
  const review = reviewFromWorksheet(details);
  const saved = saveReview(id, review);
  const errors = updateReadiness(details, item, saved);
  updatePatchPreview(details, item);
  if (errors.length) {
    showStatus(details, `Saved, but approval remains locked: ${errors.join(" ")}`, "warning");
  } else {
    showStatus(details, "Saved. Human verification and canonical patch preflight are complete; this event is ready for approval/export.", "success");
  }
}

function approvalGuard(event) {
  const button = event.target.closest?.('[data-review-status="approved"][data-review-id]');
  if (!button) return;
  const item = currentItem(button.dataset.reviewId);
  if (!item?.researchPacket) return;
  const review = getReview(item.id);
  const errors = approvalErrors(item, review);
  if (errors.length === 0) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const details = button.closest(".update-card")?.querySelector(".analyst-workbench");
  if (details) {
    details.open = true;
    updatePatchPreview(details, item);
    showStatus(details, `Approval blocked: ${errors.join(" ")}`, "error");
  }
}

function init() {
  const pending = document.querySelector("#pending-updates");
  if (!pending) return;

  new MutationObserver(enhanceCards).observe(pending, { childList: true, subtree: true });
  enhanceCards();

  const updateFromField = (event) => {
    const details = event.target.closest?.(".analyst-workbench");
    if (!details) return;
    if (event.target.matches('[name="patchMode"]')) updatePatchFields(details);
    const item = currentItem(details.dataset.analystReviewId);
    if (item) updatePatchPreview(details, item);
  };

  pending.addEventListener("change", updateFromField);
  pending.addEventListener("input", updateFromField);
  pending.addEventListener("click", (event) => {
    const seed = event.target.closest("[data-analyst-seed]");
    if (seed) return handleSeed(seed);
    const save = event.target.closest("[data-analyst-save]");
    if (save) return handleSave(save);
  });
  document.addEventListener("click", approvalGuard, true);
}

window.AnalystReview = {
  getReview,
  validateForApproval(item) {
    return approvalErrors(item, getReview(item.id));
  },
  buildReviewedPacket(item, reviewStatus, options = {}) {
    const review = getReview(item.id);
    if (reviewStatus === "approved") {
      const errors = approvalErrors(item, review);
      if (errors.length) throw new Error(errors.join(" "));
    }
    return buildReviewedPacket(item, review, reviewStatus, options);
  },
  getPatchPreview(item) {
    const review = getReview(item.id);
    if (canonicalDataStatus !== "ready") return null;
    return buildPatchPreview(item, review, canonicalIndustryFor(item));
  },
  getExportReview(id) {
    return cloneExportReview(getReview(id));
  }
};

function cloneExportReview(review) {
  return review ? JSON.parse(JSON.stringify(review)) : null;
}

void canonicalDataPromise;
init();
