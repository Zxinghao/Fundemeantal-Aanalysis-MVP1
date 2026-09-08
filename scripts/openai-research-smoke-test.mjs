import { enrichWithOpenAI } from "./openai-research-agent.mjs";

const apiKey = process.env.OPENAI_API_KEY || "";
const model = process.env.OPENAI_RESEARCH_MODEL || "gpt-5.6-luna";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured for the smoke test.");
}

const syntheticEvent = {
  id: "synthetic-openai-smoke-test",
  status: "pending",
  impactType: "capacity_change",
  evidenceLevel: "A",
  analysis: {
    affectedTarget: "company:synthetic-smoke-test",
    matchedKeywords: ["capacity", "supply"]
  },
  researchPacket: {
    evidence: [{
      sourceType: "synthetic_test_fixture",
      evidenceLevel: "A",
      matchedKeywords: ["capacity", "supply"],
      changeSet: {
        status: "comparable",
        method: "synthetic-smoke-test",
        addedCount: 1,
        removedCount: 1,
        added: ["SYNTHETIC TEST ONLY: annual production capacity is now 20 units."],
        removed: ["SYNTHETIC TEST ONLY: annual production capacity was 10 units."],
        currentRelevant: ["SYNTHETIC TEST ONLY: annual production capacity is now 20 units."]
      }
    }],
    semanticCandidate: {
      schemaVersion: "1.0",
      status: "candidate",
      generator: { type: "synthetic_smoke_fixture", version: "1.0" },
      target: "company:synthetic-smoke-test",
      observedFacts: [],
      interpretation: {
        status: "candidate",
        type: "capacity_change",
        statement: "Synthetic capacity-change fixture for API connectivity testing only.",
        confidence: "low",
        rationale: "This event is not production research data.",
        requiresPrimarySourceVerification: true
      },
      scoreImpact: {
        status: "review_required",
        candidateDimensions: ["supplyChainImportance", "scarcity"],
        direction: null,
        proposedScores: {},
        reason: "Synthetic fixture; no production score authority."
      }
    },
    claim: {
      status: "unverified"
    },
    proposedPatch: {
      status: "draft",
      executable: false,
      operations: []
    }
  }
};

const result = await enrichWithOpenAI([syntheticEvent], {
  apiKey,
  model,
  maxEvents: 1
});

if (result.skipped) throw new Error("Smoke test unexpectedly skipped OpenAI enrichment.");
if (result.failures.length) throw new Error(`OpenAI smoke test failed: ${result.failures[0].error}`);
if (result.enriched !== 1) throw new Error(`Expected one LLM candidate, received ${result.enriched}.`);

const candidate = syntheticEvent.researchPacket.llmCandidate;
if (!candidate) throw new Error("OpenAI smoke test returned no candidate.");
if (candidate.status !== "candidate") throw new Error("Smoke-test candidate escaped candidate-only status.");
if (candidate.scoreImpact?.direction !== null) throw new Error("Smoke-test candidate received unauthorized score direction.");
if (Object.keys(candidate.scoreImpact?.proposedScores || {}).length) throw new Error("Smoke-test candidate received unauthorized numeric scores.");
if (syntheticEvent.researchPacket.claim.status !== "unverified") throw new Error("Smoke test mutated claim authority.");
if (syntheticEvent.researchPacket.proposedPatch.executable !== false) throw new Error("Smoke test mutated patch authority.");

console.log(`OpenAI research smoke test passed with model ${candidate.generator?.model || model}.`);
console.log(`Returned ${candidate.observedFacts?.length || 0} candidate fact(s) with confidence ${candidate.interpretation?.confidence || "unknown"}.`);
console.log("Synthetic fixture was kept in memory only; no research data files were modified.");
