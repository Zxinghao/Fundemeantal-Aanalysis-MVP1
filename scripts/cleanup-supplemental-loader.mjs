import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "app.js");

const headerBlock = `const supplementalIndustryFiles = [\n  "data/industries/ai-optics.json"\n];\n\n`;
const loaderBlock = `  const supplementalIndustries = await loadSupplementalIndustries();\n  return mergeIndustries(data, supplementalIndustries);\n}\n\nasync function loadSupplementalIndustries() {\n  const loaded = await Promise.all(\n    supplementalIndustryFiles.map((url) => fetchJsonObjectIfAvailable(url))\n  );\n\n  return loaded.filter(Boolean);\n}\n\nasync function fetchJsonObjectIfAvailable(url) {\n  try {\n    const response = await fetch(url, { cache: "no-store" });\n    if (!response.ok) return null;\n\n    const data = await response.json();\n    return data && typeof data === "object" && !Array.isArray(data) ? data : null;\n  } catch {\n    return null;\n  }\n}\n\nfunction mergeIndustries(baseIndustries, supplementalIndustries) {\n  const byId = new Map(baseIndustries.map((industry) => [industry.id, industry]));\n\n  supplementalIndustries.forEach((industry) => {\n    byId.set(industry.id, industry);\n  });\n\n  return Array.from(byId.values());\n}\n`;

let text = await fs.readFile(appPath, "utf8");
if (!text.includes(headerBlock)) throw new Error("Expected supplemental header block was not found.");
if (!text.includes(loaderBlock)) throw new Error("Expected supplemental loader block was not found.");

text = text.replace(headerBlock, "");
text = text.replace(loaderBlock, "  return data;\n}\n");
await fs.writeFile(appPath, text);
console.log("Removed the obsolete supplemental industry loader from app.js.");
