# Supply Chain Bottleneck Radar

Supply Chain Bottleneck Radar is a static, human-in-the-loop research system for mapping industry supply chains, monitoring primary sources, separating evidence from claims, and identifying important suppliers, chokepoint nodes, and underappreciated hidden bottleneck candidates.

The canonical research database currently contains two populated industries: automotive fuel cells and AI optical modules.

## Preview

Primary GitHub Pages URL:

https://zxinghao.github.io/Fundemeantal-Aanalysis-MVP1/

The repository publishes `main` to `gh-pages` and explicitly requests a GitHub Pages build so repository updates are reflected on the public site.

## Core Features

- Render an industry supply-chain map from one canonical industry database.
- Inspect company/node roles, evidence, manually curated flags, and a versioned six-factor Hidden Bottleneck Composite.
- Monitor official/priority sources with daily or weekly cadence.
- Preserve bounded keyword-focused watched-context snapshots instead of archiving full third-party pages.
- Generate Review Desk events only when a source has a comparable baseline and its watched context actually changes.
- Represent scanner candidates as `Evidence -> Claim -> Proposed Patch` research packets.
- Add deterministic semantic candidates and optional OpenAI LLM research candidates without granting either layer approval authority.
- Require an Analyst Worksheet and explicit primary-source verification before a structured scanner claim can become `supported`.
- Preview the exact canonical patch path, current value, proposed value, rationale, and source IDs before approval.
- Support review states: pending, approved, rejected, and needs more evidence.
- Apply only explicit, whitelisted, atomic patches to reviewed candidate data.
- Require any reviewed component-score change to carry a matching `scoreEvidence` record in the same patch.
- Expose monitored-source readiness, baseline coverage, errors, and cadence health in Research Operations.
- Validate canonical data, watchlists, research packets, semantic/LLM authority invariants, scoring evidence, scanner behavior, and JavaScript syntax in CI.

## Research Data Flow

```text
source-watchlist.json
  -> web-scan.mjs
       -> full-page fingerprint
       -> bounded watched-context snapshot
       -> watched-context diff only when a comparable baseline exists
  -> persistent generated-update-events.json
       -> Evidence
       -> unverified Claim
       -> draft Proposed Patch
       -> deterministic semantic candidate
       -> optional OpenAI LLM candidate
  -> Review Desk
       -> Analyst Worksheet
       -> primary-source verification
       -> Final Patch Preview
  -> exported review-decisions schema v2 JSON
  -> apply-review-decisions.mjs
       -> validate human-review authority
       -> persist review status
       -> preflight the whole patch atomically
       -> require score + scoreEvidence coupling for score changes
       -> industries.reviewed.json
  -> human inspection
  -> promote-reviewed-data.mjs
  -> canonical industries.json
  -> GitHub Pages
```

Research Operations is parallel to the Review Desk: it reports source readiness and failures, but it has no authority to support a claim or mutate canonical research data.

## Scanner Baseline Policy

A watched-context baseline is an operational prerequisite, not a research event.

- A first successful fetch establishes a baseline and does not create a Review Desk event.
- A successful legacy cache row that has a full-page hash but no watched-context snapshot is due immediately, even if it is normally weekly, so the missing watched-context baseline can be backfilled without waiting another week.
- A configured source URL change invalidates the old baseline and triggers a fresh baseline on the new URL.
- A failed weekly source is retried on the next scan instead of waiting for the weekly cadence.
- A source is comparable only when its cached URL matches the configured URL and both a full-page hash and watched-context snapshot exist.
- Review Desk events are created only for `comparable` changes with at least one added or removed watched-context window.
- Full-page fingerprint changes with unchanged watched context stay out of the Review Desk.

This keeps baseline establishment and source maintenance in Research Operations, while reserving analyst attention for actual comparable disclosure changes.

## Watched-Context Disclosure Diff

The scanner computes a normalized full-page hash to detect that something changed, then compares bounded text windows around configured `watchFor` terms.

For a comparable changed page, `scripts/disclosure-diff.mjs` records:

- `added` excerpts;
- `removed` excerpts;
- total added/removed counts;
- current relevant context;
- baseline status;
- the deterministic method identifier `watched-context-diff-v1`.

The cache deliberately stores only a limited number of short excerpts rather than full third-party pages.

A watched-context diff narrows the review target; it is not proof of materiality. Dynamic content, nearby boilerplate, or reordered text can still create noise. The reviewer must open the primary source and verify the disclosure in context before supporting a claim.

## Semantic and LLM Candidate Layers

Comparable scanner events can be enriched twice before human review:

1. `deterministic_heuristic` produces a conservative semantic candidate from the bounded changed excerpts.
2. The optional OpenAI Research Agent uses the Responses API with Structured Outputs to generate a second candidate interpretation.

Both layers remain candidate-only. They cannot:

- mark a fact verified;
- set a claim to `supported`;
- make a patch executable;
- choose a score direction;
- propose numeric scores;
- mutate `data/industries.json`.

LLM source excerpts are treated as untrusted data, the request uses bounded context, and model/API failure is isolated so deterministic scanner outputs can still be committed.

## Analyst Review and Final Patch Preview

Structured scanner events require a completed Analyst Worksheet before approval.

The reviewer must:

- confirm that the primary source was opened and checked;
- write the verified finding/claim;
- record the rationale;
- assign human confidence;
- choose an explicit patch disposition.

`Use AI candidate as draft` only copies machine-generated text into editable fields; it does not verify the source or approve the claim.

Before approval, Final Patch Preview resolves the exact canonical target and shows:

- operation type;
- canonical field path;
- current value;
- proposed value;
- change/no-op status;
- rationale;
- linked source IDs.

The preview is read-only preflight. Backend atomic validation remains the authority that decides whether an exported patch can be applied.

## Hidden Bottleneck Composite

Rubric v1.0 is stored in `data/scoring-rubric.json`.

| Dimension | Weight |
| --- | ---: |
| Supply chain importance | 20% |
| Scarcity | 20% |
| Pricing power | 10% |
| Switching cost | 15% |
| Validation barrier | 15% |
| Market underappreciation | 20% |

Classification thresholds:

- `>= 80`: High-conviction hidden bottleneck candidate
- `>= 70`: Hidden bottleneck candidate
- `>= 60`: Watchlist / partial bottleneck
- `< 60`: Not currently a hidden bottleneck

The formula is reproducible, but legacy component inputs remain provisional until evidence is backfilled.

## scoreEvidence

A company may attach dimension-specific evidence under:

```text
companies.<companyId>.scoreEvidence.<dimension>
```

A valid record contains:

```json
{
  "score": 86,
  "rationale": "Why the evidence supports this numeric band.",
  "sourceIds": ["official-source-id"],
  "evidenceDate": "2026-09-08",
  "provenance": {
    "type": "reviewed_research_packet",
    "eventId": "event-id",
    "claimId": "claim-id"
  }
}
```

Allowed provenance types are `reviewed_research_packet`, `manual_research`, and `legacy_backfill`.

A reviewed patch cannot change `companies.<id>.scores.<dimension>` unless the same atomic patch also replaces `companies.<id>.scoreEvidence.<dimension>` with a record whose `score` matches the new value. Evidence can be backfilled without changing the score, but the evidence record must match the current score exactly.

The public company detail view displays evidence coverage dimension by dimension. Missing records are shown as evidence gaps instead of being silently treated as validated inputs.

## Research Operations

Research Operations reads the existing watchlist and source cache only. It does not create new research authority.

For the selected industry it classifies monitored sources as:

- Ready for comparison;
- Baseline pending;
- Source error;
- Not checked.

It also exposes baseline time, last check, watch-term coverage, captured watched-context count, overdue cadence, and primary-source links. `Ready for comparison` means the scanner is able to compare a future relevant change; it does not mean a material event currently exists.

## Important Files

- `index.html`: web entry point.
- `app.js`: supply-chain map, composite-score presentation, and Review Desk queue.
- `research-evidence-ui.js`: score-evidence coverage, watched-context diff, and candidate presentation.
- `analyst-review.js`: Analyst Worksheet and Final Patch Preview UI.
- `research-ops.js`: source-health / scanner-readiness UI.
- `data/industries.json`: canonical industry research database.
- `data/scoring-rubric.json`: versioned Hidden Bottleneck Composite methodology.
- `data/source-watchlist.json`: monitored sources, cadence, targets, and watch keywords.
- `data/source-cache.json`: fingerprints, bounded watched-context snapshots, timestamps, and fetch errors.
- `data/generated-update-events.json`: persistent candidate-event store.
- `scripts/disclosure-diff.mjs`: watched-context snapshot and diff logic.
- `scripts/candidate-interpretation.mjs`: deterministic semantic candidate logic.
- `scripts/openai-research-agent.mjs`: optional guarded OpenAI candidate enrichment.
- `scripts/analyst-review-model.mjs`: human-review authority, canonical operations, and patch-preview model.
- `scripts/source-health-model.mjs`: read-only source readiness/health model.
- `scripts/research-model.mjs`: research packets, score-evidence validation, scoring helpers, and atomic whitelisted patch engine.
- `scripts/web-scan.mjs`: source scanner and persistent event-store writer.
- `scripts/apply-review-decisions.mjs`: persists review state and creates reviewed candidate data.
- `scripts/promote-reviewed-data.mjs`: promotes reviewed data after explicit human confirmation.
- `scripts/validate-data.mjs`: canonical data and research integrity validation.
- `scripts/validate-watchlist.mjs`: watchlist/source-target integrity validation.

## Risk Controls

- Baseline establishment never becomes a materiality claim.
- Page fingerprint change, changed watched context, semantic candidate, supported claim, and database mutation are separate states.
- Scanner and LLM claims remain unverified until human review.
- Short watched-context excerpts are review aids, not automatic statements of materiality.
- Structured approval requires explicit human primary-source verification.
- Final Patch Preview resolves the intended canonical mutation before approval without applying it.
- Score changes require a matching score-evidence record in the same atomic patch.
- If any patch operation fails whitelist, target, value, authority, or score-evidence coupling checks, the entire patch is rejected without partial mutation.
- Existing manual fields `isKeySupplier`, `isBottleneck`, and `isZisuCandidate` remain separate from the provisional quantitative classification.
- Promotion remains an explicit human-controlled step.

## Current Research Limits and Next Milestone

The system now has a real AI-assisted, human-verified research workflow, but the production Golden Path is not yet empirically complete. Existing historical scanner events predate the current comparable-diff rules, and no new real disclosure has yet travelled all the way from a comparable watched-context change through LLM candidate, Analyst Review, Final Patch Preview, Apply, and Promotion.

The immediate operational milestone is therefore:

1. make all viable monitored sources comparable-ready;
2. keep broken or stale sources visible and repair/replace them deliberately;
3. wait for the first genuine comparable disclosure change rather than fabricating one;
4. run that event through the full production Golden Path;
5. use reviewed research to backfill `scoreEvidence` for the highest-priority companies dimension by dimension.

A successful synthetic smoke test proves the OpenAI integration path; it does not substitute for a real production disclosure event.
