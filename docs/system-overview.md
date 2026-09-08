# System Overview

## Product Goal

The platform maps an industry from end demand to systems, components, materials, and companies. Its purpose is to identify critical supply-chain bottlenecks and underappreciated hidden-bottleneck candidates while keeping the research trail auditable.

The canonical database currently contains populated automotive fuel-cell and AI optical-module industries.

## Frontend Modules

### Supply Chain Map

Files:

- `index.html`
- `app.js`
- `styles.css`
- `apple-style.css`
- `node-details.js`
- `company-flags.js`
- `research-model.css`

Functions:

- Read the single canonical `data/industries.json` database.
- Read the versioned `data/scoring-rubric.json` methodology.
- Render industry nodes and relationship edges.
- Open company and supply-chain node detail views.
- Display linked evidence and manually curated bottleneck flags.
- Compute and display a deterministic Hidden Bottleneck Composite separately from the manual flags.

### Review Desk

Files:

- `app.js`
- `review-export.js`
- `review-export.css`
- `research-model.css`

Functions:

- Merge persistent scanner events, map candidates, and user submissions into one review queue.
- Display structured Evidence -> Claim -> Proposed Patch packets when available.
- Support review states: pending, approved, rejected, and needs more evidence.
- Keep immediate browser review state in local storage.
- Export review decisions, including structured research packets, as JSON.
- Persist exported scanner-event review state back to repository data when `Apply Review Decisions` runs.

## Data Modules

### Canonical Industry Data

File:

- `data/industries.json`

This is the only canonical industry-map source. It includes industry descriptions, nodes, relationships, companies, evidence sources, signals, component scores, and reviewed update events.

Industry-specific supplemental files must not override canonical data.

### Scoring Rubric

File:

- `data/scoring-rubric.json`

This versioned methodology defines the six score dimensions, weights, anchors, classification thresholds, and evidence policy. The browser and validation layer both read the same data file so the methodology is not hidden in presentation code.

The current component scores are provisional because most predate per-dimension evidence records. The composite arithmetic is reproducible; the underlying inputs are not yet fully evidence-auditable.

### Watchlist

File:

- `data/source-watchlist.json`

Includes daily and weekly monitored sources, company IDs, node IDs, keywords, and source language metadata.

### Persistent Scanner Event Store

File:

- `data/generated-update-events.json`

This is a persistent candidate-event store. New detected events are merged with existing events rather than replacing history. New scanner events may contain a `researchPacket` with:

- observed evidence;
- an explicitly unverified claim;
- a draft, non-executable proposed patch.

Review state can be written back so decisions survive later scans.

### Source Cache

File:

- `data/source-cache.json`

Stores the latest fingerprint, source title, last check time, last change time, and fetch error for each watched source. Weekly watchlist entries are only fetched when their interval is due.

## Automation Modules

### Research Model

File:

- `scripts/research-model.mjs`

Purpose:

- Build conservative structured research packets.
- Map source type to coarse evidence level.
- Compute the versioned Hidden Bottleneck Composite.
- Classify the composite using rubric thresholds.
- Validate research-packet shape.
- Apply only whitelisted explicit patch operations.

Supported executable patch targets are intentionally narrow: company recent updates, selected company signals, the six score dimensions, and node summaries.

### Source Scan

File:

- `scripts/web-scan.mjs`

Purpose:

- Scan source pages that are due for their configured cadence.
- Detect page-content fingerprint changes.
- Record keyword context.
- Build a structured research packet whose claim remains `unverified`.
- Merge new candidates into the persistent event store.
- Update `source-cache.json`.

This remains a deterministic change detector. It does not identify the exact changed sentence or autonomously assert that an investment thesis changed.

### Apply Review Decisions

File:

- `scripts/apply-review-decisions.mjs`

Purpose:

- Read exported review JSON.
- Persist scanner-event review status.
- Record review state on matching existing industry update events.
- Apply a structured patch only when it is explicitly `ready`, executable, and supported by the whitelist.
- Prevent a generic approved scanner observation from silently becoming an official company note.
- Generate `data/industries.reviewed.json` without directly overwriting canonical data.

Legacy review items without a structured research packet retain the previous reviewed-note behavior for backward compatibility.

### Promote Reviewed Data

File:

- `scripts/promote-reviewed-data.mjs`

Purpose:

- Promote `industries.reviewed.json` to canonical `industries.json` after explicit human confirmation.
- Preserve the previous canonical data version.

### Data Validation

File:

- `scripts/validate-data.mjs`

Purpose:

- Reject duplicate industry, node, company, source, and event IDs.
- Reject broken node/company/source references.
- Validate watchlist targets and scanner-event references.
- Validate review states and structured research packets.
- Require all six component scores to remain numeric and within 0-100.
- Require scoring-rubric dimensions to match the supported score model.
- Require rubric weights to sum to 1.
- Confirm that every company can produce a valid 0-100 composite.

The `Validate Research Data` GitHub Action also performs JavaScript syntax checks and research-pipeline regression tests.

### Publishing

Publishing has one owner: `Publish Static Site`. Any workflow that changes persistent repository state commits to `main`; the resulting push triggers `Publish Static Site`, which mirrors current `main` to `gh-pages` and explicitly requests a GitHub Pages build. Source-scan and promotion workflows do not publish independently, avoiding duplicate force-pushes and competing Pages builds.

## Usage Flow

1. Automated scans check due source pages.
2. Changed pages become persistent pending candidates with observed evidence, an unverified claim, and a draft patch.
3. The reviewer opens the source and distinguishes what was actually disclosed from what the evidence may imply.
4. The reviewer records approve, reject, or needs-more-evidence and exports the decisions.
5. `Apply Review Decisions` persists event state. Only an explicit executable patch can mutate reviewed candidate fields.
6. `industries.reviewed.json` is inspected before promotion.
7. `Promote Reviewed Data` is run only after explicit confirmation.
8. Canonical `industries.json` is updated; its commit to `main` triggers the single publishing workflow and a real Pages build.

## Current Limits

- The product is still a static web app without a database, authentication, or server-side multi-user review state.
- Browser review state still requires an export/apply step before it becomes repository-persistent.
- The scanner does not yet extract the exact changed disclosure or produce a semantically supported claim automatically.
- Scanner-generated proposed patches are deliberately non-executable placeholders until the evidence is verified.
- Existing component scores are provisional and usually lack per-dimension rationale/source/date/provenance records.
- Manual supplier/bottleneck/hidden flags remain separate from rubric classification until score evidence coverage is strong enough to justify reconciliation.

The next research-quality milestone is per-dimension score evidence plus semantic disclosure extraction. See `docs/research-methodology.md`.
