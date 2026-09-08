# Research Methodology

## Purpose

The product should distinguish observed evidence from an investment or supply-chain claim, and distinguish both of those from the database mutation that would follow if the claim is accepted.

The core review unit is therefore:

```text
Evidence -> Claim -> Proposed Patch -> Human Review -> Reviewed Candidate -> Promotion
```

A source-page change is not itself a thesis change.

## Structured Research Packet

Scanner events may include a `researchPacket` with schema version `1.0`.

### Evidence

Evidence records what was actually observed from a source. The deterministic scanner currently records:

- source ID and source type;
- source URL and page title;
- observation time;
- evidence level;
- matched watch keywords;
- a factual observation that the page fingerprint changed;
- an explicit limitation that the scanner does not identify the exact changed sentence.

Evidence levels are intentionally coarse:

- `A`: company official source, government source, or exchange filing;
- `B`: industry media or general media;
- `C`: placeholder or weak source.

Evidence level is a source-quality label, not a claim-confidence score.

### Claim

A claim is a statement about what the evidence may imply for the supply-chain thesis.

The deterministic scanner creates only an `unverified` claim. It must not infer that an order, capacity expansion, qualification, customer win, pricing change, or bottleneck change occurred merely because a page fingerprint changed.

A future semantic research agent may promote a claim to `supported` only when it identifies the exact disclosure and can explain why the evidence supports the statement.

### Proposed Patch

The patch is the explicit database mutation implied by an accepted claim.

Scanner-generated packets use a non-executable `draft` placeholder. They cannot silently modify official research data.

The patch engine currently allows only whitelisted operations:

- append a string to `companies.<companyId>.recentUpdates`;
- replace one of the approved `companies.<companyId>.signals.*` fields;
- replace one of the six `companies.<companyId>.scores.*` dimensions with a value from 0 to 100;
- replace `nodes.<nodeId>.summary`.

An executable patch must have `status: "ready"`, `executable: true`, and must not require human input.

Approval of a draft research packet records the review decision but does not turn a generic source-change observation into an official company note.

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

## Critical Limitation: Current Scores Are Provisional

The v1.0 formula is now explicit and deterministic, but the existing component inputs were created before a per-dimension evidence schema existed.

Therefore the current composite score must be treated as **provisional**.

The next quality milestone is `scoreEvidence` coverage for each material dimension. A score should become evidence-backed only when it has:

1. a written rationale;
2. one or more linked source IDs;
3. an evidence date;
4. a reviewer or model provenance field;
5. enough specific evidence to justify the numeric band.

Until then, the arithmetic is auditable but the inputs are not fully auditable.

## Manual Flags Versus Rubric Classification

The existing fields `isKeySupplier`, `isBottleneck`, and `isZisuCandidate` are manually curated research labels.

They are intentionally not rewritten automatically by rubric v1.0. The UI labels these as manual flags, while the composite shows a separate provisional rubric classification.

This separation prevents a new formula from silently changing an existing research conclusion before the underlying score evidence has been reviewed.
