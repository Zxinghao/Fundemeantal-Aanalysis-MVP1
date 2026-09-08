import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateAgentCandidate } from "./openai-research-agent.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eventsPath = path.join(root, "data", "generated-update-events.json");

export function validateLlmEvents(events) {
  const errors = [];
  for (const event of Array.isArray(events) ? events : []) {
    const candidate = event?.researchPacket?.llmCandidate;
    if (!candidate) continue;
    const expectedTarget = event?.researchPacket?.semanticCandidate?.target || event?.analysis?.affectedTarget || null;
    for (const error of validateAgentCandidate(candidate, expectedTarget)) {
      errors.push(`${event.id || "unknown-event"}: ${error}`);
    }
    if (event?.researchPacket?.claim?.status === "supported" && candidate.status !== "verified") {
      // The candidate may coexist with a separately human-verified claim, but it must never
      // be represented as the evidence that authorized that claim.
      if (event.researchPacket.claim?.provenance?.source === "llmCandidate") {
        errors.push(`${event.id}: a supported claim cannot cite an unverified llmCandidate as its authorizing provenance.`);
      }
    }
  }
  return errors;
}

export async function runValidation() {
  const events = JSON.parse(await fs.readFile(eventsPath, "utf8"));
  const errors = validateLlmEvents(events);
  if (errors.length) throw new Error(errors.join("\n"));
  return { checked: events.filter((event) => event?.researchPacket?.llmCandidate).length };
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runValidation()
    .then(({ checked }) => console.log(`Validated ${checked} LLM research candidate(s).`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
