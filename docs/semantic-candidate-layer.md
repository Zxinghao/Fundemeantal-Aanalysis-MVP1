# Semantic Candidate Layer

## Purpose

The semantic candidate layer sits between deterministic source-change evidence and a supported research claim.

```text
Watched-context diff
  -> candidate observed facts
  -> candidate interpretation
  -> score dimensions to review
  -> primary-source verification
  -> supported claim
  -> explicit reviewed patch
```

It exists to make source changes easier to review without allowing an automated detector to turn a changed page into an official business or investment conclusion.

## Current generator

The current generator is `deterministic_heuristic` version `1.0`. It is deliberately conservative.

It can:

- pair added and removed keyword-focused excerpts;
- isolate a possible before/after numeric change when comparable quantities are present;
- ignore year-like unitless values when looking for a business quantity change;
- label the likely event type and the score dimensions that a reviewer may need to inspect.

It cannot:

- determine that two numbers have the same business meaning merely because they appear in nearby text;
- mark its own candidate fact as verified;
- support an investment claim by itself;
- assign score direction or numeric score changes;
- make an executable database patch.

## Data shape

Scanner events may receive `researchPacket.semanticCandidate` after the source scan.

Key fields:

- `status`: `candidate`, `verified`, or `rejected`;
- `generator`: records whether output came from a deterministic heuristic, a future LLM research agent, or manual research;
- `observedFacts`: review leads grounded in changed excerpts;
- `interpretation`: a candidate explanation of what the change may concern;
- `scoreImpact`: only identifies dimensions to review at candidate stage. Direction and proposed scores remain empty until verification.

## Safety invariants

- A deterministic heuristic cannot mark itself `verified`.
- A supported claim cannot rely on a semantic candidate that is still `candidate`.
- Candidate-stage score impact cannot set a direction or propose numeric scores.
- Primary-source verification is required before a candidate fact or interpretation is promoted.
- Existing `Evidence -> Claim -> Proposed Patch -> Human Review -> Promotion` controls remain authoritative.

## Future LLM integration

A future research agent can implement the same schema with `generator.type = "llm_research_agent"`.

The LLM should receive only bounded source excerpts plus source metadata, then return structured candidate facts and interpretation. It should not receive authority to change canonical scores or company conclusions. Any LLM-produced candidate remains reviewable and must pass the same verification and patch controls before promotion.
