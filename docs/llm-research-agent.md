# LLM Research Agent

The LLM Research Agent is an optional enrichment layer between deterministic semantic candidates and human review.

## Execution order

`web scan -> watched-context diff -> deterministic semantic candidate -> optional OpenAI LLM candidate -> human review -> supported claim -> executable patch -> promotion`

## Inputs

The model receives only bounded research context already produced by the scanner:

- event target and impact type;
- source type / evidence level;
- matched watch keywords;
- up to four added, removed, and current-relevant excerpts, capped at 260 characters each;
- the deterministic candidate as a review aid.

It does **not** receive or archive the full third-party page.

External excerpts are treated as untrusted data. Prompt-like instructions inside source text must not be followed.

## Output authority

LLM output is stored as `researchPacket.llmCandidate` and is always stamped locally as:

- `status: candidate`;
- `generator.type: llm_research_agent`;
- `requiresPrimarySourceVerification: true` for all candidate facts and interpretation;
- `scoreImpact.direction: null`;
- `scoreImpact.proposedScores: {}`.

The LLM layer cannot mark a claim `supported`, cannot make a patch executable, cannot modify canonical industry data, and cannot change a score.

## Model / API

The workflow uses the OpenAI Responses API with Structured Outputs and `store: false`. The default model is `gpt-5.6-luna`, chosen for bounded high-volume candidate extraction. It can be overridden with `OPENAI_RESEARCH_MODEL`.

The GitHub repository must contain an Actions secret named `OPENAI_API_KEY` for live LLM enrichment. If the secret is absent, the agent exits successfully and the deterministic research pipeline continues unchanged.

To bound spend, a scan processes at most five eligible events by default (`OPENAI_RESEARCH_MAX_EVENTS`).

## Eligibility

An event is sent to the LLM only when all of these are true:

1. event status is `pending`;
2. a deterministic semantic candidate exists and is still `candidate`;
3. watched-context diff is `comparable`;
4. at least one added or removed watched-context excerpt exists;
5. the event does not already contain an LLM candidate.

This prevents the model from running on first-baseline events, unchanged pages, already reviewed events, or the same event repeatedly.
