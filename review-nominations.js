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
  if(heading)heading.textContent="行业与公司消息";
  const intro=document.createElement("p");
  intro.className="desk-feed-intro";
  intro.textContent="查看监控消息、批注重要变化，选择节点或连线后交给 Dual Agents 核查。批注不是事实验证或发布批准。";
  desk.querySelector(".desk-review .section-heading")?.after(intro);

  const side=desk.querySelector(".desk-side");
  if(side){
    const advanced=document.createElement("details");
    advanced.className="desk-advanced card";
    const summary=document.createElement("summary");
    summary.textContent="更多工具：来源健康、手动提交证据";
    side.before(advanced);advanced.append(summary,side);
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
    const summary=makeField("summary","","添加批注 / 加入 Dual Agents 分析");
    details.append(summary);
    const area=makeField("div","desk-nomination-form");
    const note=makeField("textarea","","");
    note.className="desk-annotation";
    note.rows=3;note.maxLength=1500;
    note.placeholder="写下你认为这条消息重要的理由、需要核实的事实，以及可能影响哪段供应链（至少10个字符）。";
    note.value=current.annotation||"";
    note.setAttribute("aria-label","研究批注");
    const graphChange=makeField("select","desk-graph-change");
    graphChange.setAttribute("aria-label","建议研究的供应链变化类型");
    options(graphChange,[
      ["update_company","更新公司信息或瓶颈判断"],
      ["update_node","修改已有节点"],
      ["add_node","提议新增节点"],
      ["add_relationship","提议新增供应链连线"],
      ["remove_relationship","提议删除供应链连线"],
      ["update_relationship","提议修订供应链连线"]
    ]);
    graphChange.value=current.proposedGraphChange|| (item.companyId?"update_company":"update_node");

    const relation=makeField("div","desk-endpoint-fields");
    const from=makeField("select","");from.setAttribute("aria-label","起点节点");
    const to=makeField("select","");to.setAttribute("aria-label","终点节点");
    const company=makeField("select","");company.setAttribute("aria-label","关联公司");
    const node=makeField("select","");node.setAttribute("aria-label","关联节点");
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
    const source=makeField("input","desk-source-input");source.type="url";source.placeholder="官方公告链接 https://...";
    source.value=current.sourceUrl||sourceFor(item);
    source.setAttribute("aria-label","证据来源链接");
    const label=makeField("label","desk-note-label","拟影响的部分");
    const status=makeField("small","desk-nomination-status",
      current.annotation?"已有本地批注；尚未提交双 Agent":"批注仅保存在当前浏览器");
    const row=makeField("div","desk-nomination-buttons");
    const local=makeField("button","desk-local-save","保存批注");local.type="button";
    const submit=makeField("button","desk-send-agents","加入 Dual Agents 分析 →");submit.type="button";
    row.append(local,submit);
    const help=makeField("p","desk-nomination-help",
      "为保护项目写入权限，提交时会打开 GitHub 预填表单；需登录并再点 Submit new issue，后台才会正式入队。内容会在公开仓库 Issue 中可见。");
    relation.append(from,to,node,company);
    area.append(note,label,graphChange,relation,source,row,status,help);
    details.append(area);
    const actionSection=card.querySelector(".review-actions");
    const reviewSection=makeField("details","desk-final-review");
    reviewSection.append(makeField("summary","","最终人工审批（高级）"));
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
      if(data.annotation.length<10)return "批注至少10个字符，说明为什么值得核实。";
      try{const u=new URL(data.sourceUrl);if(!["https:","http:"].includes(u.protocol))throw Error("scheme");}
      catch{return "请提供有效的 HTTP(S) 原始资料链接。";}
      if(data.targetType==="relationship"&&data.from===data.to)return "连线起点与终点不能相同。";
      if(!data.targetId&&data.targetType!=="relationship")return "请先选择目标企业或节点。";
      return null;
    }
    local.addEventListener("click",()=>{
      const value=draft();save(item.id,value);
      status.textContent="批注已保存在当前浏览器，尚未提交分析。";
    });
    submit.addEventListener("click",()=>{
      const data=draft();const error=validate(data);
      if(error){status.textContent=error;details.open=true;return;}
      save(item.id,data);
      const issueBody="## Supply Chain Research Desk 提名\n\n"+
        "由仓库所有者在网页端发起，属于**待核实的研究假设**；不构成批准或产业链变更。\n\n"+
        "<!-- RADAR_RESEARCH_NOMINATION_V1_BEGIN -->\n"+
        JSON.stringify(data,null,2)+"\n<!-- RADAR_RESEARCH_NOMINATION_V1_END -->\n";
      const title="[RADAR NOMINATION] "+data.industryId+" · "+data.proposedGraphChange+" · "+data.headline.slice(0,55);
      const url="https://github.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/issues/new?"+
        new URLSearchParams({title,body:issueBody}).toString();
      status.textContent="已准备 GitHub 提交表单。请在新页面确认提交 Issue；否则仅保留本地草稿。";
      const popup=window.open(url,"_blank","noopener,noreferrer");
      if(!popup)window.location.href=url;
    });
  }
  function enhance(){
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
