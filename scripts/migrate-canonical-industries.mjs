import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(root, "data", "industries.json");
const supplementalPath = path.join(root, "data", "industries", "ai-optics.json");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(supplementalPath))) {
    console.log("Supplemental AI optics file already migrated; nothing to do.");
    return;
  }

  const canonical = JSON.parse(await fs.readFile(canonicalPath, "utf8"));
  const aiOptics = JSON.parse(await fs.readFile(supplementalPath, "utf8"));

  if (!Array.isArray(canonical)) {
    throw new Error("data/industries.json must be an array.");
  }
  if (!aiOptics?.id) {
    throw new Error("Supplemental industry must have an id.");
  }

  const next = canonical.filter((industry) => industry.id !== aiOptics.id);
  next.push(aiOptics);

  const ids = next.map((industry) => industry.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Industry ids must be unique after migration.");
  }

  await fs.writeFile(canonicalPath, `${JSON.stringify(next, null, 2)}\n`);
  await fs.unlink(supplementalPath);
  console.log(`Migrated ${aiOptics.id} into canonical data/industries.json and removed the supplemental copy.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
