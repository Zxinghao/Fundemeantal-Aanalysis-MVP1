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

Functions:

- Read the single canonical `data/industries.json` database.
- Render industry nodes and relationship edges.
- Open a company detail dialog when a company node is clicked.
- Open a supply-chain node detail view for non-company nodes.
- Display linked evidence and hidden-bottleneck signals.

### Review Desk

Files:

- `app.js`
- `review-export.js`
- `review-export.css`

Functions:

- Merge persistent scanner events, map candidates, and user submissions into one review queue.
- Support review states: pending, approved, rejected, and needs more evidence.
- Keep immediate browser review state in local storage.
- Export review decisions as JSON.
- Persist exported scanner-event review state back to repository data when `Apply Review Decisions` runs.

## Data Modules

### Canonical Industry Data

File:

- `data/industries.json`

This is the only canonical industry-map source. It includes:

- Industry descriptions and research theses.
- Supply-chain nodes.
- Relationships.
- Company profiles.
- Scores and signals.
- Evidence sources.
- Reviewed update events.
- `languagePolicy`, which declares English as the primary language and prioritizes English official sources.

Industry-specific supplemental files must not override canonical data.

### Watchlist

File:

- `data/source-watchlist.json`

Includes:

- Daily and weekly monitored sources.
- Company IDs.
- Node IDs.
- Keywords.
- Source language metadata.

### Persistent Scanner Event Store

File:

- `data/generated-update-events.json`

This is a persistent candidate-event store. New detected events are merged with existing events rather than replacing the file's history. Review state can be written back to these events so approved, rejected, and needs-more-evidence decisions survive later scans.

### Source Cache

File:

- `data/source-cache.json`

Stores the latest fingerprint, source title, last check time, last change time, and fetch error for each watched source. Weekly watchlist entries are only fetched when their interval is due.

## Automation Modules

### Source Scan

File:

- `scripts/web-scan.mjs`

Purpose:

- Scan English-priority source pages that are due for their configured cadence.
- Detect page-content fingerprint changes.
- Merge new source-change candidates into the persistent event store.
- Update `source-cache.json`.

This is a change detector with keyword context. It does not yet semantically interpret the investment meaning of a disclosure.

### Apply Review Decisions

File:

- `scripts/apply-review-decisions.mjs`

Purpose:

- Read exported review JSON.
- Persist scanner-event review status.
- Record review state on matching existing industry update events.
- Apply approved research notes to a reviewed candidate database.
- Generate `data/industries.reviewed.json` without directly overwriting canonical data.

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
- Validate review states.
- Require all six score dimensions to remain numeric and within 0-100.

The `Validate Research Data` GitHub Action also performs JavaScript syntax checks and research-pipeline regression tests.

### Publishing

Publishing has one owner: `Publish Static Site`. Any workflow that changes persistent repository state commits to `main`; the resulting `main` push triggers `Publish Static Site`, which mirrors current `main` to `gh-pages` and explicitly requests a GitHub Pages build. Source-scan and promotion workflows do not publish independently, avoiding duplicate force-pushes and competing Pages builds.

## Usage Flow

1. Automated scans check due source pages.
2. Changed pages become persistent pending candidates in `generated-update-events.json`.
3. The reviewer inspects the source evidence in the web review desk.
4. The reviewer records approve, reject, or needs-more-evidence and exports the decisions.
5. `Apply Review Decisions` persists event state and creates `industries.reviewed.json`.
6. The reviewed candidate database is inspected before promotion.
7. `Promote Reviewed Data` is run only after explicit confirmation.
8. Canonical `industries.json` is updated; its commit to `main` triggers the single publishing workflow and a real Pages build.

## Current Limits

- The product is still a static web app without a database, authentication, or server-side multi-user review state.
- Browser review state still requires an export/apply step before it becomes repository-persistent.
- The scanner detects page changes and keyword matches but does not extract claims or interpret investment meaning semantically.
- Review application does not automatically produce structured patches to scores, nodes, relationships, or bottleneck flags.
- Existing hidden-bottleneck scores are not yet backed by a formal evidence-to-score rubric.

The next research-layer milestone is an Evidence -> Claim -> Proposed Patch model with explicit evidence links, before/after values, rationale, confidence, and human approval for every material thesis change.
