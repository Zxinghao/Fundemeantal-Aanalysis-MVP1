import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("all first-party UI, Telegram alerts and documentation remain English-only", () => {
  const assets=[
    "index.html", "app.js", "product-journey.js", "research-ops.js",
    "analyst-review.js", "research-evidence-ui.js", "review-export.js",
    "dual-review-ui.js", "review-nominations.js",
    "scripts/telegram-dual-alerts.mjs", "scripts/telegram-bot-smoke-test.mjs",
    "README.md",
    ...fs.readdirSync(path.join(root,"docs")).filter(x=>x.endsWith(".md")).map(x=>"docs/"+x)
  ];
  for(const asset of assets) {
    assert.doesNotMatch(read(asset),/[\u3400-\u9fff]/u,`${asset} contains non-English UI or documentation copy`);
  }
});

test("Research Desk displays the Dual Agents report first and folds source monitoring below the update feed", () => {
  const ui=read("review-nominations.js");
  const html=read("index.html");
  const css=read("review-nominations.css");
  assert.match(ui,/grid\.after\(side\)/);
  assert.match(ui,/document\.createElement\("details"\)/);
  assert.match(ui,/systemStatus\.append\(summary,operations\)/);
  assert.match(ui,/sourceHealth/);
  assert.match(css,/#view-desk \.desk-system-status/);
  assert.match(html,/lang="en"/);
  assert.match(html,/id="view-desk"/);
});

test("Telegram alerts explicitly warn that proposals are not approved or deployed",()=>{
  const alerts=read("scripts/telegram-dual-alerts.mjs");
  assert.match(alerts,/Awaiting human approval/);
  assert.match(alerts,/graph unchanged/);
});
