import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewedPath = path.join(root, "data", "industries.reviewed.json");
const officialPath = path.join(root, "data", "industries.json");
const backupPath = path.join(root, "data", "industries.previous.json");

export function assertIndustryData(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Reviewed industry data must be a non-empty array.");
  }

  for (const industry of data) {
    if (!industry.id || !industry.name || !Array.isArray(industry.nodes) || !Array.isArray(industry.relationships)) {
      throw new Error(`Reviewed industry data has an invalid industry entry: ${industry.id || "unknown"}`);
    }
  }
}

async function main() {
  const confirmation = process.argv[2];
  if (confirmation !== "PROMOTE") {
    console.log("Usage: node scripts/promote-reviewed-data.mjs PROMOTE");
    console.log("This command replaces data/industries.json with data/industries.reviewed.json.");
    process.exitCode = 1;
    return;
  }

  const officialText = await fs.readFile(officialPath, "utf8");
  const reviewedText = await fs.readFile(reviewedPath, "utf8");
  const reviewedData = JSON.parse(reviewedText);
  assertIndustryData(reviewedData);

  await fs.writeFile(backupPath, officialText.endsWith("\n") ? officialText : `${officialText}\n`);
  await fs.writeFile(officialPath, `${JSON.stringify(reviewedData, null, 2)}\n`);

  console.log(`Promoted ${reviewedPath} to ${officialPath}`);
  console.log(`Previous official data saved to ${backupPath}`);
}

const cliEntry = globalThis.process?.argv?.[1];
if (cliEntry && fileURLToPath(import.meta.url) === path.resolve(cliEntry)) {
  main().catch((error) => {
    console.error(error);
    globalThis.process.exitCode = 1;
  });
}
