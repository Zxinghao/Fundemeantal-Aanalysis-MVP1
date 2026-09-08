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
- Compute a versioned Hidden Bottleneck Composite from six explicit weighted dimensions.
- Let users submit official data, filings, announcements, or research notes for review.
- Detect watched-source page changes and route persistent candidate events into a review desk.
- Represent scanner candidates as structured `Evidence -> Claim -> Proposed Patch` research packets.
- Support review states: pending, approved, rejected, and needs more evidence.
- Export review decisions as JSON and persist reviewed scanner-event status back to the repository.
- Apply only explicit, whitelisted executable patches to reviewed candidate data.
- Promote reviewed candidate data separately after human confirmation.
- Validate data integrity, research-packet shape, scoring-rubric invariants, and JavaScript syntax on repository changes.

## Language And Source Policy

- English is the primary product language.
- Data fields, UI labels, review events, scanner output, and documentation should be written in English.
- Source collection prioritizes English official sources, investor relations pages, filings, government sources, standards bodies, and company materials.
- Non-English sources may be used when they provide primary evidence that is not available in English; they should be summarized in English before entering the review workflow.

## Canonical Data Model

`data/industries.json` is the single canonical source for industry maps. Industry-specific supplemental files must not override the canonical database.

The canonical data contains industry descriptions, nodes, relationships, companies, evidence sources, signals, scores, and reviewed update events. `scripts/validate-data.mjs` checks cross-references and structural invariants before changes are accepted.

The scoring methodology is separately versioned in `data/scoring-rubric.json` so arithmetic methodology is not hidden inside UI code.

## Research Data Flow

```text
source-watchlist.json
  -> web-scan.mjs
  -> persistent generated-update-events.json
       -> Evidence
       -> unverified Claim
       -> draft Proposed Patch
  -> review desk
  -> exported review-decisions JSON
  -> apply-review-decisions.mjs
       -> persist review status
       -> apply only explicit executable whitelisted patches
       -> industries.reviewed.json
  -> human inspection
  -> promote-reviewed-data.mjs
  -> canonical industries.json
  -> GitHub Pages
```

`generated-update-events.json` is a persistent event store. A later scan does not delete an older unreviewed candidate merely because the source did not change again.

A scanner-generated research packet is intentionally conservative: it records that a page changed and what watched terms are present, but it does not claim that an order, customer win, capacity expansion, qualification, or thesis change occurred unless that disclosure has been explicitly verified.

## Hidden Bottleneck Composite

Rubric v1.0 uses the following weights:

- Supply chain importance: 20%
- Scarcity: 20%
- Pricing power: 10%
- Switching cost: 15%
- Validation barrier: 15%
- Market underappreciation: 20%

Classification thresholds:

- `>= 80`: High-conviction hidden bottleneck candidate
- `>= 70`: Hidden bottleneck candidate
- `>= 60`: Watchlist / partial bottleneck
- `< 60`: Not currently a hidden bottleneck

The composite is deterministic, but the current component inputs are still **provisional** because most scores predate per-dimension evidence records. The existing manual fields `isKeySupplier`, `isBottleneck`, and `isZisuCandidate` remain separate from the provisional rubric classification.

See `docs/research-methodology.md` for methodology details and limitations.

## Important Files

- `index.html`: Web entry point.
- `app.js`: Supply-chain map, composite-score presentation, and review-desk logic.
- `node-details.js`: Non-company node detail view.
- `company-flags.js`: Displays manually curated supplier/bottleneck/hidden flags separately from rubric classification.
- `review-export.js`: Review-decision and structured research-packet export.
- `research-model.css`: Research-packet and composite-score presentation styles.
- `data/industries.json`: Canonical industry research database.
- `data/scoring-rubric.json`: Versioned Hidden Bottleneck Composite methodology.
- `data/source-watchlist.json`: Daily and weekly source watchlist.
- `data/source-cache.json`: Latest source fingerprints, check timestamps, and fetch errors.
- `data/generated-update-events.json`: Persistent source-change candidate event store.
- `scripts/research-model.mjs`: Research-packet construction, scoring helpers, and whitelisted patch engine.
- `scripts/web-scan.mjs`: Source-change detector and event-store writer.
- `scripts/apply-review-decisions.mjs`: Persists review status and applies approved explicit patches to reviewed candidate data.
- `scripts/promote-reviewed-data.mjs`: Promotes reviewed data after human confirmation.
- `scripts/validate-data.mjs`: Validates IDs, references, scores, rubric invariants, packet shape, event status, and watchlist consistency.

## GitHub Actions

- `Source Scan`: runs daily at 06:15 UTC. Daily sources are checked each run; weekly sources are skipped until their weekly interval is due. Changed-source candidates are merged into the persistent event store.
- `Validate Research Data`: runs syntax, regression, rubric, and data-integrity checks on pushes and pull requests.
- `Apply Review Decisions`: reads exported review JSON, persists scanner-event review state, and generates `industries.reviewed.json`.
- `Promote Reviewed Data`: promotes reviewed data to canonical `industries.json` after manual confirmation.
- `Approve And Promote`: combines review application and promotion when a reviewer intentionally chooses the one-step path.
- `Publish Static Site`: mirrors current `main` to `gh-pages` and explicitly requests a GitHub Pages build.

## Daily Operating Loop

1. `Source Scan` checks sources that are due for their configured cadence.
2. A detected page change is merged into the persistent event store as a pending candidate with structured evidence, an unverified claim, and a non-executable draft patch.
3. The public site exposes the candidate in the review desk.
4. A reviewer opens the underlying evidence and records approve, reject, or needs-more-evidence.
5. Exported decisions are applied so review state survives across devices and future scans.
6. Only an explicit `ready` and executable whitelisted patch can mutate reviewed candidate fields; a generic scanner observation cannot silently become official research data.
7. Reviewed candidate data is inspected before promotion.
8. Only a separate promotion step can replace canonical `industries.json`.
9. Publication then triggers a real GitHub Pages build.

## Risk Controls

- The scanner detects source changes; it does not claim that a supply-chain or investment thesis changed.
- Evidence, claim, and proposed database mutation are stored as separate objects.
- Scanner-generated patches are draft and non-executable by default.
- The patch engine only accepts a small whitelist of company/node fields and score values from 0 to 100.
- Approval of a draft research packet does not silently append a generic page-change note to official company research.
- Promotion requires explicit human confirmation using `PROMOTE` and preserves the previous official data version.
- The validator blocks duplicate IDs, broken references, invalid review states, malformed packets, invalid rubric weights, and out-of-range scores.

## Known Research Limits

The current source scanner is still a deterministic change detector plus keyword layer, not a semantic AI research analyst. It now produces a correct research *structure*, but it does not yet extract the exact changed disclosure or write a supported investment claim automatically.

The scoring formula is now explicit and versioned, but the existing six component values remain provisional until each material dimension has its own rationale, linked evidence, evidence date, and provenance.

The next research-quality milestone is therefore **per-dimension score evidence coverage plus semantic disclosure extraction**. That is the point where the system can begin to justify not only its arithmetic, but also the inputs that drive the ranking.
