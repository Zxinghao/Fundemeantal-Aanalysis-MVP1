import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNomination, ingestNomination } from "../scripts/ingest-research-nomination.mjs";

const industry={id:"ai-optics",companies:[{id:"abc"}],nodes:[{id:"laser"},{id:"package"}]};
const nomination={
 schemaVersion:"1.0", industryId:"ai-optics", eventId:"event-123",
 headline:"A new supply relationship may affect the upstream laser industry",
 sourceUrl:"https://example.org/company-press",
 annotation:"Please verify this claimed supply agreement from its original disclosure.",
 proposedGraphChange:"add_relationship",targetType:"relationship",from:"laser",to:"package"
};
function makeIssue(data=nomination,owner="Zxinghao"){
 return { number:42,title:"[RADAR NOMINATION] AI optics supply chain",
  user:{login:owner},state:"open",created_at:"2026-11-11T08:00:00Z",
  html_url:"https://github.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/issues/42",
  body:"<!-- RADAR_RESEARCH_NOMINATION_V1_BEGIN -->\n"+JSON.stringify(data)+"\n<!-- RADAR_RESEARCH_NOMINATION_V1_END -->"
 };
}
const events=[{id:"event-123",industryId:"ai-optics",sourceUrl:nomination.sourceUrl}];

test("validated owner nomination becomes a pending proposal, never a graph update",async()=>{
 const record=validateNomination(makeIssue(),[industry],events);
 assert.equal(record.id,"nomination-issue-42");
 assert.equal(record.isVerified,false);assert.equal(record.isExecutable,false);
 assert.equal(record.from,"laser");assert.equal(record.to,"package");
 const once=await ingestNomination(makeIssue(),[industry],events,[],"Zxinghao");
 const twice=await ingestNomination(makeIssue(),[industry],events,once,"Zxinghao");
 assert.equal(twice.length,1);
});

test("non-owner, malicious or incorrect source cannot enter research queue",()=>{
 assert.throws(()=>validateNomination(makeIssue(nomination,"stranger"),[industry],events),/owner/);
 assert.throws(()=>validateNomination(makeIssue({...nomination,sourceUrl:"https://unrelated.example"}),[industry],events),/conflicts/);
 assert.throws(()=>validateNomination(makeIssue({...nomination,to:"nonexistent"}),[industry],events),/Unknown relationship/);
 assert.throws(()=>validateNomination(makeIssue({...nomination,annotation:"ok"}),[industry],events),/Invalid evidence/);
 assert.throws(()=>validateNomination(makeIssue({...nomination,proposedGraphChange:"execute_js"}),[industry],events),/Invalid nomination/);
});
