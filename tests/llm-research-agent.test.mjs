import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentInput, enrichWithOpenAI, validateAgentCandidate } from "../scripts/openai-research-agent.mjs";

function baseEvent() {
  return {
    id: "event-1",
    status: "pending",
    impactType: "capacity_change",
    evidenceLevel: "A",
    analysis: { affectedTarget: "company:forvia" },
    researchPacket: {
      evidence: [{
        sourceType: "company_official",
        evidenceLevel: "A",
        matchedKeywords: ["hydrogen", "capacity"],
        changeSet: {
          status: "comparable",
          addedCount: 1,
          removedCount: 1,
          added: ["Hydrogen storage capacity increased to 20,000 systems per year."],
          removed: ["Hydrogen storage capacity was 10,000 systems per year."],
          currentRelevant: ["Hydrogen storage capacity increased to 20,000 systems per year."]
        }
      }],
      semanticCandidate: {
        status: "candidate",
        target: "company:forvia",
        observedFacts: [],
        interpretation: { statement: "Potential capacity change." },
        scoreImpact: { candidateDimensions: ["supplyChainImportance", "scarcity"] }
      },
      claim: { status: "unverified" },
      proposedPatch: { status: "draft", executable: false, operations: [] }
    }
  };
}

function fakeResponse(body = {}) {
  return {
    ok: true,
    async json() {
      return {
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              observedFacts: [{
                type: "capacity_quantity_change",
                statement: "The watched context contains a possible capacity change from 10,000 to 20,000 systems per year.",
                beforeExcerpt: "Hydrogen storage capacity was 10,000 systems per year.",
                afterExcerpt: "Hydrogen storage capacity increased to 20,000 systems per year."
              }],
              interpretation: {
                statement: "This may indicate a capacity disclosure change.",
                rationale: "The before and after excerpts use the same capacity unit, but the primary source still requires verification.",
                confidence: "medium"
              },
              scoreImpact: {
                candidateDimensions: ["supplyChainImportance", "scarcity"],
                reason: "Capacity may affect supply importance or scarcity, but no direction is authorized before verification."
              },
              ...body
            })
          }]
        }]
      };
    }
  };
}

test("agent input contains only bounded evidence and deterministic metadata", () => {
  const input = buildAgentInput(baseEvent());
  assert.equal(input.target, "company:forvia");
  assert.equal(input.addedContext.length, 1);
  assert.match(input.addedContext[0], /20,000/);
  assert.equal(input.deterministicCandidate.scoreImpact.candidateDimensions[0], "supplyChainImportance");
});

test("missing API key skips enrichment without mutating event", async () => {
  const event = baseEvent();
  const result = await enrichWithOpenAI([event], { apiKey: "" });
  assert.equal(result.skipped, true);
  assert.equal(result.enriched, 0);
  assert.equal(event.researchPacket.llmCandidate, undefined);
});

test("LLM enrichment adds only a candidate and leaves claim and patch conservative", async () => {
  const event = baseEvent();
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return fakeResponse();
  };

  const result = await enrichWithOpenAI([event], {
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    fetchImpl
  });

  assert.equal(result.enriched, 1);
  assert.equal(result.failures.length, 0);
  assert.equal(event.researchPacket.llmCandidate.status, "candidate");
  assert.equal(event.researchPacket.llmCandidate.generator.type, "llm_research_agent");
  assert.equal(event.researchPacket.llmCandidate.target, "company:forvia");
  assert.equal(event.researchPacket.llmCandidate.scoreImpact.direction, null);
  assert.deepEqual(event.researchPacket.llmCandidate.scoreImpact.proposedScores, {});
  assert.equal(event.researchPacket.claim.status, "unverified");
  assert.equal(event.researchPacket.proposedPatch.executable, false);
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.match(requestBody.instructions, /untrusted source data/);
});

test("OpenAI failure is isolated and does not attach an unsafe partial candidate", async () => {
  const event = baseEvent();
  const fetchImpl = async () => ({
    ok: false,
    status: 503,
    async text() { return "temporary model outage"; }
  });

  const result = await enrichWithOpenAI([event], {
    apiKey: "test-key",
    fetchImpl
  });

  assert.equal(result.enriched, 0);
  assert.equal(result.failures.length, 1);
  assert.equal(event.researchPacket.llmCandidate, undefined);
  assert.equal(event.researchPacket.claim.status, "unverified");
  assert.equal(event.researchPacket.proposedPatch.executable, false);
});

test("agent candidate validator rejects score authority", () => {
  const candidate = {
    schemaVersion: "1.0",
    status: "candidate",
    generator: { type: "llm_research_agent" },
    target: "company:forvia",
    observedFacts: [],
    interpretation: {
      status: "candidate",
      confidence: "medium",
      requiresPrimarySourceVerification: true
    },
    scoreImpact: {
      candidateDimensions: ["scarcity"],
      direction: "increase",
      proposedScores: { scarcity: 90 }
    }
  };
  const errors = validateAgentCandidate(candidate, "company:forvia");
  assert.ok(errors.some((error) => error.includes("cannot set a score direction")));
  assert.ok(errors.some((error) => error.includes("cannot propose numeric scores")));
});
