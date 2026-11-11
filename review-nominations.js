/* Focused Research Desk: user notes and owner-authenticated nomination intake.
   Annotations are local until the user confirms a GitHub Issue submission.
   Neither this script nor the issue workflow can modify the canonical graph. */
(() => {
  "use strict";
  const desk=document.querySelector("#view-desk");
  const container=document.querySelector("#pending-updates");
  const selector=document.querySelector("#industry-select");
  if(!desk||!container)return;

  const heading=desk.querySelector(".desk-review .section-heading h2");
  if(heading)heading.textContent="Industry & Company Updates";
  const intro=document.createElement("p");
  intro.className="desk-feed-intro";
  intro.textContent="Review monitored updates, add research notes, and nominate a company, node, or connection for independent analysis. Notes are not verified facts or publication approvals.";
  desk.querySelector(".desk-review .section-heading")?.after(intro);

  // Keep the research feed primary. Operational diagnostics stay at the
  // bottom and remain closed unless the user explicitly opens them.
  const side=desk.querySelector(".desk-side");
  const grid=desk.querySelector(".desk-grid");
  if(side && grid){
    grid.after(side);
    side.classList.add("desk-bottom-tools");
    const operations=side.querySelector(".research-ops");
    if(operations){
      const systemStatus=document.createElement("details");
      systemStatus.className="desk-system-status card";
      const summary=document.createElement("summary");
      summary.textContent="System Status · Source Monitoring";
      operations.before(systemStatus);
      systemStatus.append(summary,operations);
    }
    const submitEvidence=side.querySelector(".submit-card");
    if(submitEvidence)submitEvidence.classList.add("desk-evidence-tools");
  }

  const STORE="radar.reviewAnnotations.v2";
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||"{}")||{};}catch{return {};}};
  const save=(id,draft)=>{
    const store=read();store[id]={...draft,savedAt:new Date().toISOString()};
    localStorage.setItem(STORE,JSON.stringify(store));
  };
  const escText=(text)=>String(text==null?"":text);
  let industryData=[];
  fetch("data/industries.json",{cache:"no-store"})
    .then((r)=>r.ok?r.json():[])
    .then((data)=>{industryData=Array.isArray(data)?data:[];enhance();})
    .catch(()=>{industryData=[];});
  function currentIndustry() {
    return industryData.find((x)=>x.id===selector?.value) || null;
  }
  function sourceFor(item) {
    const direct=item.source;
    try{const x=new URL(direct);if(["http:","https:"].includes(x.protocol))return x.href;}catch{}
    const industry=currentIndustry();
    const sourceId=(item.sourceIds||[])[0];
    return industry?.sources?.find((source)=>source.id===sourceId)?.url || "";
  }
  function makeField(tag,cls,label){
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(label!==undefined)el.textContent=label;
    return el;
  }
  function options(select,values){
    values.forEach(([value,label])=>{
      const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);
    });
  }
  function renderCard(card,item){
    if(card.querySelector(".desk-nomination"))return;
    const current=read()[item.id]||{};
    const details=makeField("details","desk-nomination");
    const summary=makeField("summary","","Add note / Send to Dual Agents");
    details.append(summary);
    const area=makeField("div","desk-nomination-form");
    const note=makeField("textarea","","");
    note.className="desk-annotation";
    note.rows=3;note.maxLength=1500;
    note.placeholder="Explain why this update matters, what still needs verification, and which supply-chain relationship might be affected (at least 10 characters).";
    note.value=current.annotation||"";
    note.setAttribute("aria-label","Research note");
    const graphChange=makeField("select","desk-graph-change");
    graphChange.setAttribute("aria-label","Proposed supply-chain change");
    options(graphChange,[
      ["update_company","Update company or bottleneck assessment"],
      ["update_node","Update existing node"],
      ["add_node","Propose a new node"],
      ["add_relationship","Propose a new connection"],
      ["remove_relationship","Propose removing a connection"],
      ["update_relationship","Propose changing a connection"]
    ]);
    graphChange.value=current.proposedGraphChange|| (item.companyId?"update_company":"update_node");

    const relation=makeField("div","desk-endpoint-fields");
    const from=makeField("select","");from.setAttribute("aria-label","From node");
    const to=makeField("select","");to.setAttribute("aria-label","To node");
    const company=makeField("select","");company.setAttribute("aria-label","Target company");
    const node=makeField("select","");node.setAttribute("aria-label","Target node");
    function fill(){
      const industry=currentIndustry();
      if(!industry)return;
      const nodes=(industry.nodes||[]).map((n)=>[n.id,n.title+" ("+n.id+")"]);
      const companies=(industry.companies||[]).map((c)=>[c.id,c.name]);
      for(const select of [from,to,node,company])select.replaceChildren();
      options(from,nodes);options(to,nodes);options(node,nodes);options(company,companies);
      from.value=current.from||item.nodeId||nodes[0]?.[0]||"";
      to.value=current.to||nodes.find((x)=>x[0]!==from.value)?.[0]||"";
      node.value=current.targetId||item.nodeId||nodes[0]?.[0]||"";
      company.value=current.targetId||item.companyId||companies[0]?.[0]||"";
    }
    fill();
    const source=makeField("input","desk-source-input");source.type="url";source.placeholder="Official source URL https://...";
    source.value=current.sourceUrl||sourceFor(item);
    source.setAttribute("aria-label","Evidence source URL");
    const label=makeField("label","desk-note-label","Proposed change");
    const status=makeField("small","desk-nomination-status",
      current.annotation?"Draft saved locally; not submitted to Dual Agents":"Notes are saved only in this browser");
    const row=makeField("div","desk-nomination-buttons");
    const local=makeField("button","desk-local-save","Save Note");local.type="button";
    const submit=makeField("button","desk-send-agents","Send to Dual Agents →");submit.type="button";
    row.append(local,submit);
    const help=makeField("p","desk-nomination-help",
      "For security, this opens a prefilled GitHub Issue. Sign in and select Submit new issue to queue the request. Your issue content is visible in the public repository.");
    relation.append(from,to,node,company);
    area.append(note,label,graphChange,relation,source,row,status,help);
    details.append(area);
    const actionSection=card.querySelector(".review-actions");
    const reviewSection=makeField("details","desk-final-review");
    reviewSection.append(makeField("summary","","Final Human Approval (Advanced)"));
    if(actionSection){
      actionSection.before(details);
      actionSection.before(reviewSection);
      reviewSection.append(actionSection);
    }else card.append(details,reviewSection);

    function updateFields(){
      const mode=graphChange.value;
      const relationMode=mode.endsWith("relationship");
      from.hidden=!relationMode;to.hidden=!relationMode;
      node.hidden=mode!=="update_node";
      company.hidden=mode!=="update_company";
      relation.classList.toggle("is-relationship",relationMode);
    }
    graphChange.addEventListener("change",updateFields);updateFields();

    function draft(){
      const mode=graphChange.value;
      const itemTarget=mode==="update_company" ? {targetType:"company",targetId:company.value} :
        mode==="update_node" ? {targetType:"node",targetId:node.value} :
        mode==="add_node" ? {targetType:"industry",targetId:selector?.value} :
        {targetType:"relationship",from:from.value,to:to.value};
      return {
        schemaVersion:"1.0",industryId:selector?.value||"",
        eventId:item.origin==="AI scan"?item.id:null,
        headline:escText(item.summary||item.company||"Research event").slice(0,400),
        sourceUrl:source.value.trim(),annotation:note.value.trim(),
        proposedGraphChange:mode,...itemTarget
      };
    }
    function validate(data){
      if(data.annotation.length<10)return "Please enter at least 10 characters explaining why this requires investigation.";
      try{const u=new URL(data.sourceUrl);if(!["https:","http:"].includes(u.protocol))throw Error("scheme");}
      catch{return "Please provide a valid HTTP(S) source URL."; }
      if(data.targetType==="relationship"&&data.from===data.to)return "A connection must have different source and destination nodes.";
      if(!data.targetId&&data.targetType!=="relationship")return "Please choose a target company or node.";
      return null;
    }
    local.addEventListener("click",()=>{
      const value=draft();save(item.id,value);
      status.textContent="Note saved in this browser; not yet submitted for analysis.";
    });
    submit.addEventListener("click",()=>{
      const data=draft();const error=validate(data);
      if(error){status.textContent=error;details.open=true;return;}
      save(item.id,data);
      const issueBody="## Supply Chain Research Desk Nomination\n\n"+
        "Submitted by the repository owner. This is an **unverified research hypothesis**, not an approval or an authorized change to the supply-chain graph.\n\n"+
        "<!-- RADAR_RESEARCH_NOMINATION_V1_BEGIN -->\n"+
        JSON.stringify(data,null,2)+"\n<!-- RADAR_RESEARCH_NOMINATION_V1_END -->\n";
      const title="[RADAR NOMINATION] "+data.industryId+" · "+data.proposedGraphChange+" · "+data.headline.slice(0,55);
      const url="https://github.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/issues/new?"+
        new URLSearchParams({title,body:issueBody}).toString();
      status.textContent="GitHub Issue draft opened. Confirm Submit new issue on GitHub to queue this request; otherwise it remains a local draft.";
      const popup=window.open(url,"_blank","noopener,noreferrer");
      if(!popup)window.location.href=url;
    });
  }
  function enhance(){
    if(!industryData.length || !currentIndustry())return;
    const queue=typeof buildReviewQueue==="function"?buildReviewQueue():[];
    const byId=new Map(queue.map((item)=>[String(item.id),item]));
    const cards=[...container.querySelectorAll(".update-card")];
    for(const card of cards){
      if(card.querySelector(".desk-nomination"))continue;
      const id=card.querySelector("[data-review-id]")?.dataset.reviewId;
      const item=byId.get(id);
      if(item)renderCard(card,item);
    }
  }
  const observer=new MutationObserver(()=>enhance());
  observer.observe(container,{childList:true,subtree:true});
  selector?.addEventListener("change",()=>queueMicrotask(enhance));
  enhance();
})();
