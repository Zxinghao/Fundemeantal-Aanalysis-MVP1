import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSemanticCandidate } from "./candidate-interpretation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eventsPath = path.join(root, "data", "generated-update-events.json");

export function validateSemanticEvent(event) {
  const errors = [];
  const candidate = event?.researchPacket?.semanticCandidate;
  if (!candidate) return errors;

  errors.push(...validateSemanticCandidate(candidate).map((error) => `${event.id}: ${error}`));

  const claimStatus = event?.researchPacket?.claim?.status;
  if (claimStatus === "supported" && candidate.status !== "verified") {
    errors.push(`${event.id}: a supported claim cannot rely on a semantic candidate that is not verified.`);
  }

  if (candidate.generator?.type === "deterministic_heuristic" && candidate.status === "verified") {
    errors.push(`${event.id}: deterministic heuristic output cannot mark itself verified; verification must come from manual research or a reviewed research agent.`);
  }

  if (candidate.scoreImpact?.status === "supported" && candidate.status !== "verified") {
    errors.push(`${event.id}: supported score impact requires a verified semantic candidate.`);
  }

  return errors;
}

export function validateSemanticEvents(events) {
  return (Array.isArray(events) ? events : []).flatMap(validateSemanticEvent);
}

export async function runSemanticValidation() {
  const events = JSON.parse(await fs.readFile(eventsPath, "utf8"));
  const errors = validateSemanticEvents(events);
  if (errors.length) {
    throw new Error(`Semantic candidate validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  console.log(`Validated semantic candidates in ${events.length} scanner event(s).`);
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && pathToFileURL(cliEntry).href === import.meta.url) {
  runSemanticValidation().catch((error) => {
    console.error(error.message || error);
    globalThis.process.exitCode = 1;
  });
}
