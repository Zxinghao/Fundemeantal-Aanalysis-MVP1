# Data Model

## Language Policy

English is the primary language for the product, data model, review events, scanner output, and documentation.

Each industry can include:

- `languagePolicy.primaryLanguage`: currently `en`.
- `languagePolicy.sourcePreference`: English official sources first, with non-English primary sources allowed only when they add unique evidence and are summarized in English.

## Industry

Core fields:

- `id`
- `name`
- `description`
- `terminalDemand`
- `researchThesis`
- `languagePolicy`
- `sources`
- `nodes`
- `relationships`
- `companies`
- `updateEvents`

## Node

Core fields:

- `id`
- `type`: `terminal`, `chain`, `company`, or `zisu`.
- `title`
- `summary`
- `layer`
- `tags`
- `position`

## Relationship

Core fields:

- `from`
- `to`
- `relationshipType`
- `confidence`
- `sourceIds`

## Company

Core fields:

- `id`
- `name`
- `ticker`
- `region`
- `businessRole`
- `linkedNodeIds`
- `sourceIds`
- `isKeySupplier`
- `isBottleneck`
- `isZisuCandidate`
- `signals`
- `scores`
- `recentUpdates`

## Update Event

Core fields:

- `id`
- `sourceType`
- `status`
- `industryId`
- `companyId`
- `nodeId`
- `impactType`
- `summary`
- `sourceUrl`
- `sourceNote`
- `sourceIds`
- `submittedBy`
- `reviewDecision`
- `reviewedAt`

## Score Dimensions

- `supplyChainImportance`
- `scarcity`
- `pricingPower`
- `switchingCost`
- `validationBarrier`
- `marketUnderappreciation`

## Hidden Bottleneck Candidate Rule Of Thumb

A candidate should usually have:

- High supply chain importance.
- Scarce qualified suppliers.
- Long customer validation cycles.
- Evidence from at least one credible source.
- A position that is not merely a visible end-market leader.
