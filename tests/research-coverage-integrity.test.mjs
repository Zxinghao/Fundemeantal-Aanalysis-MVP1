import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(process.cwd());
const industries=JSON.parse(fs.readFileSync(path.join(root,"data/industries.json"),"utf8"));
const watchlist=JSON.parse(fs.readFileSync(path.join(root,"data/source-watchlist.json"),"utf8"));

test("every registered company has at least one official company-level watch source",()=>{
  let companyCount=0;
  for(const industry of industries){
    const watched=Object.values(watchlist[industry.id]||{}).filter(Array.isArray).flat();
    const covered=new Set(watched.filter((s)=>s.sourceType==="company_official").map((s)=>s.companyId));
    for(const company of industry.companies){
      companyCount++;
      assert.ok(covered.has(company.id),industry.id+": "+company.id+" has no official watch source");
    }
  }
  assert.ok(companyCount>0);
});

test("watchlist company IDs and URLs are valid for each industry",()=>{
  for(const industry of industries){
    const companies=new Set(industry.companies.map((c)=>c.id));
    const watched=Object.values(watchlist[industry.id]||{}).filter(Array.isArray).flat();
    for(const item of watched){
      if(item.companyId)assert.ok(companies.has(item.companyId),item.id+": unknown companyId");
      assert.ok(/^https:\/\//.test(item.url),item.id+": official HTTPS source required");
      assert.ok(Array.isArray(item.watchFor)&&item.watchFor.length>0,item.id+": missing watch keywords");
    }
  }
});
