import fs from "node:fs/promises";

const oldUrl = "https://www.sglcarbon.com/en/markets-solutions/material/sigracet-fuel-cell-components/";
const newUrl = "https://www.sglcarbon.com/en/markets-solutions/material/sigracet/";

const targets = [
  { path: "data/industries.json", expected: 1 },
  { path: "data/source-watchlist.json", expected: 1 },
  { path: "app.js", expected: 1 }
];

for (const target of targets) {
  const current = await fs.readFile(target.path, "utf8");
  const occurrences = current.split(oldUrl).length - 1;
  if (occurrences !== target.expected) {
    throw new Error(`${target.path}: expected ${target.expected} old SGL URL occurrence(s), found ${occurrences}.`);
  }
  const next = current.replaceAll(oldUrl, newUrl);
  await fs.writeFile(target.path, next);
  console.log(`${target.path}: migrated ${occurrences} SGL URL occurrence(s).`);
}
