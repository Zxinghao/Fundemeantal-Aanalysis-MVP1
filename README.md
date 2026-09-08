# Supply Chain Bottleneck Radar

This is a static research prototype for mapping industry supply chains, tracking evidence, and identifying important suppliers, chokepoint nodes, and underappreciated hidden bottleneck candidates.

The canonical research database currently contains two populated industries: automotive fuel cells and AI optical modules.

## Preview

Primary GitHub Pages URL:

https://zxinghao.github.io/Fundemeantal-Aanalysis-MVP1/

The repository publishes `main` to `gh-pages` and explicitly requests a GitHub Pages build so repository updates are reflected on the public site.

## Core Features

- Render an industry supply-chain map from one canonical industry database.
- Inspect company/node roles, evidence, manually curated flags, and a versioned six-factor Hidden Bottleneck Composite.
- Monitor official/priority sources with daily or weekly cadence.
- Preserve a small keyword-focused context snapshot for monitored sources and compare it with the next version when the full-page fingerprint changes.
- Surface bounded added/removed watched-context excerpts in the Review Desk without treating them as semantic conclusions.
- Represent scanner candidates as `Evidence -> Claim -> Proposed Patch` research packets.
- Keep scanner claims `unverified` and scanner patches non-executable by default.
- Support review states: pending, approved, rejected, and needs more evidence.
- Apply only explicit, whitelisted, atomic patches to reviewed candidate data.
- Require any reviewed component-score change to carry a matching `scoreEvidence` record in the same patch.
- Validate data integrity, research-packet shape, scoring-rubric invariants, score-evidence records, source-cache snapshots, and JavaScript syntax.

## Research Data Flow

```text
source-watchlist.json
  -> web-scan.mjs
       -> full-page fingerprint
       -> bounded watched-context snapshot
       -> watched-context diff when a comparable baseline exists
  -> persistent generated-update-events.json
       -> Evidence
       -> unverified Claim
       -> draft Proposed Patch
  -> Review Desk
  -> exported review-decisions JSON
  -> apply-review-decisions.mjs
       -> persist review status
       -> preflight the whole patch atomically
       -> require score + scoreEvidence coupling for score changes
       -> industries.reviewed.json
  -> human inspection
  -> promote-reviewed-data.mjs
  -> canonical industries.json
  -> GitHub Pages
```

A first successful fetch establishes a baseline and is not treated as a source change. Existing cache entries created before watched-context snapshots are upgraded silently when their full-page hash is unchanged. If a page changes before a comparable context baseline exists, the event is marked `baseline_missing` rather than inventing an added/removed diff.

## Watched-Context Disclosure Diff

The scanner still computes a full normalized page hash to detect that something changed. It now also stores a bounded snapshot of text windows around configured `watchFor` keywords.

When a later page version changes, `scripts/disclosure-diff.mjs` compares the old and new watched-context windows and records:

- `added` excerpts;
- `removed` excerpts;
- total added/removed counts;
- baseline status;
- the deterministic method identifier `watched-context-diff-v1`.

The cache deliberately stores only a limited number of short excerpts instead of archiving full third-party pages.

This narrows the review target, but it is **not** semantic disclosure extraction. A dynamic navigation element, nearby boilerplate, or reordered text may still create noise. The reviewer must open the primary source and verify the disclosure in context before supporting a claim.

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

## Important Files

- `index.html`: web entry point.
- `app.js`: supply-chain map, composite-score presentation, and review-desk logic.
- `research-evidence-ui.js`: displays score-evidence coverage and watched-context diff excerpts.
- `research-model.css`: research, score-evidence, and diff presentation styles.
- `data/industries.json`: canonical industry research database.
- `data/scoring-rubric.json`: versioned Hidden Bottleneck Composite methodology.
- `data/source-watchlist.json`: monitored sources, cadence, targets, and watch keywords.
- `data/source-cache.json`: fingerprints, bounded watched-context snapshots, timestamps, and fetch errors.
- `data/generated-update-events.json`: persistent candidate-event store.
- `scripts/disclosure-diff.mjs`: watched-context snapshot and diff logic.
- `scripts/research-model.mjs`: research-packet construction, score-evidence validation, scoring helpers, and atomic whitelisted patch engine.
- `scripts/web-scan.mjs`: source scanner and event-store writer.
- `scripts/apply-review-decisions.mjs`: persists review state and creates reviewed candidate data.
- `scripts/promote-reviewed-data.mjs`: promotes reviewed data after explicit human confirmation.
- `scripts/validate-data.mjs`: structural, research, score-evidence, cache, and reference validation.
- `tests/research-pipeline.test.mjs`: research-pipeline regression tests.

## Risk Controls

- A first source fetch creates a baseline; it does not create a fake change event.
- Page fingerprint change, changed watched context, supported claim, and database mutation are separate concepts.
- Scanner-generated claims remain `unverified` and patches remain draft/non-executable.
- Short watched-context excerpts are review aids, not automatic statements of materiality.
- Score changes require a matching score-evidence record in the same atomic patch.
- If any patch operation fails whitelist, target, value, or score-evidence coupling checks, the entire patch is rejected without partial mutation.
- Existing manual fields `isKeySupplier`, `isBottleneck`, and `isZisuCandidate` remain separate from the provisional quantitative classification.
- Promotion remains an explicit human-controlled step.

## Current Research Limits

The scanner is now better at answering **where the relevant text changed**, but it still does not reliably answer **what the disclosure means**. It does not autonomously turn an excerpt into a supported statement about orders, qualification, capacity, pricing power, customer wins, or bottleneck status.

The `scoreEvidence` schema and enforcement now exist, but the legacy company scores have not been retroactively given invented evidence. They remain visibly under-evidenced until reviewed research is backfilled dimension by dimension.

The next high-value milestone is therefore a semantic disclosure-review layer that converts the surfaced changed excerpts into a precise candidate claim with citation-grade context, while systematically backfilling score evidence for the highest-ranked companies first.
