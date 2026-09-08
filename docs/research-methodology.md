# Research Methodology

## Purpose

The product must distinguish four different things:

```text
Observed source change
  -> Candidate evidence
  -> Research claim
  -> Proposed database mutation
```

Those stages are deliberately separate. A page change is not a thesis change, a changed excerpt is not automatically a supported claim, and an approved claim does not mutate research data unless its explicit patch passes validation.

The review unit is therefore:

```text
Evidence -> Claim -> Proposed Patch -> Human Review -> Reviewed Candidate -> Promotion
```

## Source Change Detection

The scanner keeps a full normalized page fingerprint to answer a narrow question: **did the fetched page representation change?**

A first successful fetch establishes a baseline. It does not create a candidate event because there is no previous successful version to compare against.

The full-page fingerprint is intentionally separate from the disclosure-diff layer. A changed fingerprint may come from navigation, timestamps, metadata, dynamic page elements, or a genuinely material disclosure.

## Watched-Context Diff v1

`scripts/disclosure-diff.mjs` stores a bounded snapshot of text windows surrounding configured `watchFor` keywords. The design avoids storing full copies of third-party web pages in the repository.

Each cached segment contains:

- a deterministic hash;
- a short bounded excerpt;
- the watch keyword(s) that selected the excerpt.

A snapshot stores at most 30 excerpts, each capped at 220 characters.

When a later full-page fingerprint changes and both old and new watched-context snapshots are available, the scanner computes:

- added watched-context excerpts;
- removed watched-context excerpts;
- total added and removed counts;
- method identifier `watched-context-diff-v1`.

If an old cache entry has no watched-context snapshot, the scanner uses `baseline_missing`. It may show current relevant excerpts, but it must not label them as additions because there is no comparable prior context snapshot.

A watched-context diff is still deterministic text comparison, not semantic analysis. It narrows the human review target but may capture nearby boilerplate, reordered text, or dynamic content.

## Structured Research Packet

Scanner events may include a `researchPacket` with schema version `1.0`.

### Evidence

Evidence records what was actually observed from a source:

- source ID and source type;
- source URL and page title;
- observation time;
- evidence level;
- matched watch keywords;
- a factual observation about the page/change state;
- optional watched-context `changeSet`;
- an explicit limitation describing what the deterministic scanner cannot infer.

Evidence levels are coarse source-quality labels:

- `A`: company official source, government source, or exchange filing;
- `B`: industry media or general media;
- `C`: placeholder or weak source.

Evidence level is not claim confidence.

### Claim

A claim is a statement about what evidence may imply for the supply-chain thesis.

The deterministic scanner always creates an `unverified` claim. Even when the watched-context diff isolates a plausible disclosure, the scanner must not assert an order, capacity expansion, qualification, customer win, pricing change, or bottleneck change without explicit verification.

A claim can become `supported` only when the reviewer has enough source context to state precisely what occurred and why it matters.

### Proposed Patch

The patch is the explicit database mutation implied by a supported claim.

Scanner-generated packets use a non-executable `draft` placeholder. They cannot silently modify reviewed research data.

The patch engine allows only a narrow whitelist:

- append a string to `companies.<companyId>.recentUpdates`;
- replace an approved `companies.<companyId>.signals.*` field;
- replace one of the six `companies.<companyId>.scores.*` dimensions with a value from 0 to 100;
- replace `companies.<companyId>.scoreEvidence.<dimension>` with a valid evidence record;
- replace `nodes.<nodeId>.summary`.

An executable patch requires:

- `claim.status: "supported"`;
- `proposedPatch.status: "ready"`;
- `proposedPatch.executable: true`;
- no operation still marked as requiring human input.

Patch application is atomic. Every operation is preflighted before the first mutation. If any operation fails, the entire patch is skipped.

## Hidden Bottleneck Composite

The scoring methodology is versioned in `data/scoring-rubric.json`.

Version 1.0 uses six dimensions:

| Dimension | Weight | Research question |
| --- | ---: | --- |
| Supply chain importance | 20% | How materially does failure, delay, or shortage constrain end-system output? |
| Scarcity | 20% | How limited is the pool of qualified alternatives? |
| Pricing power | 10% | Can the supplier defend price or margins because substitution is difficult or supply is constrained? |
| Switching cost | 15% | How costly, slow, or risky is substitution after design-in or qualification? |
| Validation barrier | 15% | How demanding are qualification, reliability, safety, yield, and customer-validation requirements? |
| Market underappreciation | 20% | How poorly is the strategic role reflected in common market narratives or valuation attention? |

The composite is the weighted arithmetic mean of those six inputs.

### Classification thresholds

- `>= 80`: High-conviction hidden bottleneck candidate
- `>= 70`: Hidden bottleneck candidate
- `>= 60`: Watchlist / partial bottleneck
- `< 60`: Not currently a hidden bottleneck

These thresholds are ranking aids, not investment recommendations.

## scoreEvidence

The formula can be deterministic while the inputs remain weak. A component score becomes evidence-backed only when the company has a valid record at:

```text
company.scoreEvidence.<dimension>
```

A record contains:

- `score`: the exact numeric component value it supports;
- `rationale`: why the evidence supports that score/band;
- `sourceIds`: one or more known source IDs;
- `evidenceDate`: `YYYY-MM-DD`;
- `provenance`: how the record entered the reviewed dataset.

Supported provenance types:

- `reviewed_research_packet`;
- `manual_research`;
- `legacy_backfill`.

For `reviewed_research_packet`, provenance must also identify the source review `eventId` and `claimId`.

### Score/evidence coupling rule

A patch that changes:

```text
companies.<id>.scores.<dimension>
```

must include, in the same atomic patch:

```text
companies.<id>.scoreEvidence.<dimension>
```

and the evidence record's `score` must equal the new score.

This prevents a reviewer from changing a numeric ranking input without simultaneously recording the reason, sources, date, and provenance.

Evidence may be backfilled without changing a legacy score, but its `score` must match the current component value exactly.

## Legacy Scores Remain Provisional

The existing company scores predate the `scoreEvidence` schema. The system deliberately does not fabricate retrospective rationales or sources merely to make coverage look complete.

The UI therefore displays evidence coverage explicitly. A missing record is an evidence gap, not an implicit validation.

A useful migration strategy is to backfill the highest-ranked or most decision-relevant companies first rather than filling every dimension mechanically.

## Manual Flags Versus Rubric Classification

The fields `isKeySupplier`, `isBottleneck`, and `isZisuCandidate` are manually curated research labels.

They remain separate from the provisional rubric classification. The quantitative composite does not automatically rewrite manual research conclusions until its component inputs have sufficient evidence coverage.

## Current Boundary

The platform can now answer more precisely:

- whether a monitored page changed;
- whether keyword-focused nearby text changed;
- which short excerpts were added or removed;
- whether a reviewed score has dimension-specific evidence coverage.

It still cannot reliably answer, without human or future semantic analysis:

- what the changed disclosure means in business terms;
- whether the disclosure is incremental or already known;
- whether it changes the supply-chain thesis;
- which exact numeric score change is justified.

The next research milestone is semantic disclosure review over the surfaced excerpts plus systematic score-evidence backfill for the most important companies.
