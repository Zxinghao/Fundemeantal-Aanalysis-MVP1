# Supply Chain Bottleneck Radar

This is a static research prototype for mapping industry supply chains, tracking evidence, and identifying important suppliers, chokepoint nodes, and underappreciated hidden bottleneck candidates.

The canonical research database currently contains two populated industries: automotive fuel cells and AI optical modules.

## Preview

Primary GitHub Pages URL:

https://zxinghao.github.io/Fundemeantal-Aanalysis-MVP1/

The repository publishes `main` to `gh-pages` and explicitly requests a GitHub Pages build so that repository updates are reflected on the public site.

## Core Features

- Render an industry supply chain map from a single canonical industry database.
- Click a company or supply-chain node to inspect its role, linked companies, bottleneck signals, scores, and evidence sources.
- Let users submit official data, filings, announcements, or research notes for review.
- Detect watched-source page changes and route persistent candidate events into a review desk.
- Support review states: pending, approved, rejected, and needs more evidence.
- Export review decisions as JSON and persist reviewed scanner-event status back to the repository.
- Apply reviewed evidence to a candidate database before a separate manual promotion step.
- Validate data integrity and JavaScript syntax on repository changes.

## Language And Source Policy

- English is the primary product language.
- Data fields, UI labels, review events, scanner output, and documentation should be written in English.
- Source collection prioritizes English official sources, investor relations pages, filings, government sources, standards bodies, and company materials.
- Non-English sources may be used when they provide primary evidence that is not available in English; they should be summarized in English before entering the review workflow.

## Canonical Data Model

`data/industries.json` is the single canonical source for industry maps. Industry-specific supplemental files must not override the canonical database.

The canonical data contains industry descriptions, nodes, relationships, companies, evidence sources, signals, scores, and reviewed update events. `scripts/validate-data.mjs` checks cross-references and basic structural invariants before changes are accepted.

## Research Data Flow

```text
source-watchlist.json
  -> web-scan.mjs
  -> persistent generated-update-events.json
  -> review desk
  -> exported review-decisions JSON
  -> apply-review-decisions.mjs
       -> industries.reviewed.json
       -> reviewed scanner-event status
  -> human inspection
  -> promote-reviewed-data.mjs
  -> canonical industries.json
  -> GitHub Pages
```

`generated-update-events.json` is a persistent event store. A later scan does not delete an older unreviewed candidate merely because the source did not change again.

## Important Files

- `index.html`: Web entry point.
- `app.js`: Supply-chain map and review-desk logic. Reads canonical `data/industries.json` directly.
- `node-details.js`: Non-company node detail view.
- `review-export.js`: Review-decision export.
- `data/industries.json`: Canonical industry research database.
- `data/source-watchlist.json`: Daily and weekly source watchlist.
- `data/source-cache.json`: Latest source fingerprints, check timestamps, and fetch errors.
- `data/generated-update-events.json`: Persistent source-change candidate event store.
- `scripts/web-scan.mjs`: Source-change detector and event-store writer.
- `scripts/apply-review-decisions.mjs`: Persists review status and generates reviewed candidate industry data.
- `scripts/promote-reviewed-data.mjs`: Promotes reviewed data after human confirmation.
- `scripts/validate-data.mjs`: Validates IDs, references, scores, event status, and watchlist consistency.

## GitHub Actions

- `Source Scan`: runs daily at 06:15 UTC. Daily sources are checked each run; weekly sources are skipped until their weekly interval is due. Changed-source candidates are merged into the persistent event store.
- `Validate Research Data`: runs syntax and data-integrity checks on pushes and pull requests.
- `Apply Review Decisions`: reads exported review JSON, persists scanner-event review state, and generates `industries.reviewed.json`.
- `Promote Reviewed Data`: promotes reviewed data to canonical `industries.json` after manual confirmation.
- `Approve And Promote`: combines review application and promotion when a reviewer intentionally chooses the one-step path.
- `Publish Static Site`: mirrors current `main` to `gh-pages` and explicitly requests a GitHub Pages build.

## Daily Operating Loop

1. `Source Scan` checks sources that are due for their configured cadence.
2. A detected page change is merged into the persistent event store as a pending candidate.
3. The public site exposes the candidate in the review desk.
4. A reviewer opens the underlying evidence and records approve, reject, or needs-more-evidence.
5. Exported decisions are applied so review state survives across devices and future scans.
6. Approved evidence is written to `industries.reviewed.json` for inspection.
7. Only a separate promotion step can replace canonical `industries.json`.
8. Publication then triggers a real GitHub Pages build.

## Risk Controls

- The scanner detects source changes; it does not claim that a supply-chain or investment thesis changed.
- Scanner output cannot directly edit canonical industry data.
- Review application creates reviewed candidate data and persists review state; it does not automatically rewrite scores, nodes, relationships, or hidden-bottleneck flags.
- Promotion requires explicit human confirmation using `PROMOTE` and preserves the previous official data version.
- The validator blocks duplicate IDs, broken references, invalid review states, and out-of-range scores.

## Known Research Limits

The current source scanner is a change detector plus keyword layer, not a semantic AI research analyst. Hidden-bottleneck scores are also not yet backed by a formal evidence-to-score rubric. The next research-layer milestone is to convert evidence into explicit claims and proposed structured patches, then make every material score or thesis change auditable back to evidence.
