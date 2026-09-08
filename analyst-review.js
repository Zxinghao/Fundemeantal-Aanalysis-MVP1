import {
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

function updateReadiness(details, item, explicitReview = null) {
  const review = explicitReview || getReview(item.id);
  const errors = validateAnalystReview(item, review);
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
  if (errors.length) {
    showStatus(details, `Saved, but approval remains locked: ${errors.join(" ")}`, "warning");
  } else {
    showStatus(details, "Saved. Human verification is complete and this event is ready for approval/export.", "success");
  }
}

function approvalGuard(event) {
  const button = event.target.closest?.('[data-review-status="approved"][data-review-id]');
  if (!button) return;
  const item = currentItem(button.dataset.reviewId);
  if (!item?.researchPacket) return;
  const review = getReview(item.id);
  const errors = validateAnalystReview(item, review);
  if (errors.length === 0) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const details = button.closest(".update-card")?.querySelector(".analyst-workbench");
  if (details) {
    details.open = true;
    showStatus(details, `Approval blocked: ${errors.join(" ")}`, "error");
  }
}

function init() {
  const pending = document.querySelector("#pending-updates");
  if (!pending) return;

  new MutationObserver(enhanceCards).observe(pending, { childList: true, subtree: true });
  enhanceCards();

  pending.addEventListener("change", (event) => {
    if (event.target.matches('[name="patchMode"]')) updatePatchFields(event.target.closest(".analyst-workbench"));
  });
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
    return validateAnalystReview(item, getReview(item.id));
  },
  buildReviewedPacket(item, reviewStatus, options = {}) {
    return buildReviewedPacket(item, getReview(item.id), reviewStatus, options);
  },
  getExportReview(id) {
    return cloneExportReview(getReview(id));
  }
};

function cloneExportReview(review) {
  return review ? JSON.parse(JSON.stringify(review)) : null;
}

init();
