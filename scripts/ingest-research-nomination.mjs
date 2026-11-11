import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const filename=path.join(root,"data/manual-research-requests.json");
const validChanges=new Set(["add_relationship","remove_relationship","update_relationship","add_node","update_node","update_company"]);
const validTargets=new Set(["industry","company","node","relationship"]);
const isUrl=(u)=>{try {const parsed=new URL(u);return ["https:","http:"].includes(parsed.protocol) && !!parsed.hostname;}catch{return false;}};
const getJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,"utf8"));}catch(e){if(e.code==="ENOENT")return fallback;throw e;}};

export function validateNomination(issue, industries, existingEvents, owner="Zxinghao") {
  if(issue?.user?.login!==owner || issue?.state!=="open") throw new Error("Only the repository owner may nominate research.");
  if(!issue?.title?.startsWith("[RADAR NOMINATION]"))throw new Error("Not a Research Desk nomination.");
  const body=String(issue.body||"");
  const match=body.match(/<!-- RADAR_RESEARCH_NOMINATION_V1_BEGIN -->\s*([\s\S]*?)\s*<!-- RADAR_RESEARCH_NOMINATION_V1_END -->/);
  if(!match || match[1].length>12000)throw new Error("Missing or oversized nomination JSON");
  const raw=JSON.parse(match[1]);
  const industry=industries.find((x)=>x.id===raw.industryId);
  if(raw.schemaVersion!=="1.0" || !industry || !validChanges.has(raw.proposedGraphChange) ||
     !validTargets.has(raw.targetType))throw new Error("Invalid nomination metadata.");
  if(typeof raw.annotation!=="string" || raw.annotation.trim().length<10 || raw.annotation.length>1500 ||
     typeof raw.headline!=="string" || !raw.headline.trim() || raw.headline.length>400 ||
     !isUrl(raw.sourceUrl) || String(raw.sourceUrl).length>1200)throw new Error("Invalid evidence note or URL.");
  if(raw.targetType==="company" && !industry.companies.some((x)=>x.id===raw.targetId))throw new Error("Unknown company target.");
  if(raw.targetType==="node" && !industry.nodes.some((x)=>x.id===raw.targetId))throw new Error("Unknown node target.");
  if(raw.targetType==="relationship" && (!industry.nodes.some((x)=>x.id===raw.from) ||
    !industry.nodes.some((x)=>x.id===raw.to) || raw.from===raw.to))throw new Error("Unknown relationship endpoint.");
  if(raw.targetType==="industry" && raw.targetId!==industry.id)throw new Error("Incorrect industry target.");
  if(["add_relationship","remove_relationship","update_relationship"].includes(raw.proposedGraphChange) && raw.targetType!=="relationship")
    throw new Error("Relationship change requires explicit endpoints.");
  if(raw.proposedGraphChange==="add_node" && raw.targetType!=="industry")throw new Error("Adding a node requires an industry target.");
  const matchingEvent=existingEvents.find((e)=>e.id===raw.eventId && e.industryId===industry.id);
  if(raw.eventId && (!matchingEvent || matchingEvent.sourceUrl!==raw.sourceUrl)) throw new Error("Source URL conflicts with existing scanner event.");
  return {
    id:"nomination-issue-"+issue.number, issueNumber:issue.number, status:"pending",
    submittedAt:issue.created_at, industryId:industry.id,
    targetType:raw.targetType, targetId:raw.targetId||null,
    from:raw.targetType==="relationship"?raw.from:null,
    to:raw.targetType==="relationship"?raw.to:null,
    proposedGraphChange:raw.proposedGraphChange,
    changeType:"other",
    sourceUrl:raw.sourceUrl, sourceEventId:raw.eventId||null,
    headline:raw.headline.trim(), annotation:raw.annotation.trim(),
    provenance:{type:"owner_github_issue",url:issue.html_url||null},
    isVerified:false, isExecutable:false
  };
}

export async function ingestNomination(issue, industries, events, previous, owner) {
  const record=validateNomination(issue,industries,events,owner);
  const items=Array.isArray(previous)?[...previous]:[];
  if(!items.some((item)=>item.id===record.id))items.push(record);
  return items;
}

async function main(){
  const eventFile=process.env.GITHUB_EVENT_PATH;
  if(!eventFile)throw new Error("GitHub event payload required");
  const [event,industries,events,previous]=await Promise.all([
    getJson(eventFile,{}),getJson(path.join(root,"data/industries.json"),[]),
    getJson(path.join(root,"data/generated-update-events.json"),[]),getJson(filename,[])
  ]);
  if(event.action!=="opened" || event.sender?.login!=="Zxinghao") {
    console.log("Ignored untrusted or unrelated GitHub issue event.");return;
  }
  let updated;
  try{updated=await ingestNomination(event.issue,industries,events,previous,"Zxinghao");}
  catch(error){console.log("No accepted research nomination: "+error.message);return;}
  await fs.writeFile(filename,JSON.stringify(updated,null,2)+"\n");
  console.log("Accepted verified-owner research nomination issue #"+event.issue.number+"; graph remains unchanged.");
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch((error)=>{console.error(error.message);process.exitCode=1;});
}
