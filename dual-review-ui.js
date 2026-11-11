/* Daily dual-agent findings are informational only. Browser approval remains local
   until an authenticated approval service is configured. */
(() => {
  "use strict";
  const desk = document.querySelector("#view-desk");
  const grid = desk?.querySelector(".desk-grid");
  const select = document.querySelector("#industry-select");
  if (!desk || !grid) return;

  const panel = document.createElement("section");
  panel.className = "card dual-review-panel";
  const header = document.createElement("div");
  header.className = "dual-review-heading";
  const heading = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Dual Agents";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Claude Code × Codex · Daily research across every registered industry and company";
  heading.append(title, subtitle);
  const status = document.createElement("span");
  status.className = "dual-run-status"; status.textContent = "Loading…";
  header.append(heading, status);
  const dashboard = document.createElement("div");
  dashboard.className = "dual-review-dashboard";
  const findings = document.createElement("div");
  findings.className = "dual-findings";
  const note = document.createElement("p");
  note.className = "dual-review-note";
  note.textContent = "Agreement is not independent verification. Decisions are saved locally; publication still requires the protected GitHub Approve And Promote workflow.";
  const actions = document.createElement("div");actions.className="dual-actions";
  const help = document.createElement("a");
  help.href = "https://github.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/actions/workflows/approve-and-promote.yml";
  help.target="_blank";help.rel="noopener noreferrer";help.textContent="Open protected approval workflow ↗";
  actions.append(help);
  const reportDetails=document.createElement("details");
  reportDetails.className="dual-report-details";
  const reportSummary=document.createElement("summary");
  reportSummary.textContent="View evidence, disagreements, and past research candidates";
  reportDetails.append(reportSummary,findings,note,actions);
  panel.append(header,dashboard,reportDetails);
  grid.before(panel);

  let report = null;
  let companyDirectory = [];
  function safeLink(url) {
    try { const u=new URL(url); return ["http:","https:"].includes(u.protocol)?u.href:null; }
    catch { return null; }
  }
  const sourceLabel = (status) => ({ current: "Current", stale: "Stale",
    unmonitored: "Not monitored" })[status] || status || "Unknown";
  const changeLabel = (change) => ({
    update_company: "Update company assessment", update_node: "Update existing node",
    add_node: "Add node", add_relationship: "Add connection",
    remove_relationship: "Remove connection", update_relationship: "Change connection"
  })[change] || change || "Not specified";
  const verdictLabel = (verdict) => ({
    material_candidate: "Potential material change", non_material: "No material change",
    insufficient_evidence: "Insufficient evidence"
  })[verdict] || verdict || "Unverified";
  const label = {
    consensus_candidate: "Agent consensus · Pending human verification",
    needs_evidence: "Conflicting findings / Insufficient evidence",
    non_material: "No material supply-chain change"
  };
  function metric(name, value) {
    const card = document.createElement("div");
    card.className = "dual-stat";
    const num = document.createElement("strong");num.textContent=String(value);
    const text = document.createElement("span");text.textContent=name;
    card.append(num,text);return card;
  }
  function field(name, value) {
    const wrap=document.createElement("div");wrap.className="dual-field";
    const bold=document.createElement("strong");bold.textContent=name;
    const paragraph=document.createElement("p");paragraph.textContent=value || "Not provided";
    wrap.append(bold,paragraph);return wrap;
  }
  function openEvent(eventId, industryId) {
    if (select && industryId && [...select.options].some((o)=>o.value===industryId)) {
      select.value=industryId;
      select.dispatchEvent(new Event("change",{bubbles:true}));
    }
    document.querySelector("#review-filter").value="all";
    document.querySelector("#review-filter").dispatchEvent(new Event("change",{bubbles:true}));
    const controls=[...document.querySelectorAll("#pending-updates [data-review-id]")];
    const button=controls.find((b)=>b.dataset.reviewId===eventId);
    if (button) {
      const card=button.closest(".update-card");
      card?.scrollIntoView({behavior:"smooth",block:"center"});
      const detail=card?.querySelector(".update-more");
      if (detail) detail.open=true;
      card?.classList.add("dual-highlight");
      setTimeout(()=>card?.classList.remove("dual-highlight"),4000);
    }
  }
  function render() {
    dashboard.replaceChildren();findings.replaceChildren();
    if (!report || !report.lastRunAt) {
      const registered=companyDirectory.reduce((n,ind)=>n+(ind.companies||[]).length,0);
      dashboard.append(metric("Registered industries",companyDirectory.length),
        metric("Registered companies",registered),metric("Dual-Agent run","Not started"),metric("Consensus candidates",0));
      status.textContent="No completed dual-agent research run";
      return;
    }
    const industry=select?.value;
    const items=(report.findings||[]).filter((item)=>item.industryId===industry);
    const consensus=items.filter((item)=>item.status==="consensus_candidate");
    const disagreement=items.filter((item)=>item.status==="needs_evidence");
    const sources=(report.coverage||[]).filter((item)=>item.industryId===industry);
    const companies=(report.companyCoverage||[]).filter((item)=>item.industryId===industry);
    const checked=companies.filter((item)=>item.claude && item.codex).length;
    const uncovered=companies.filter((item)=>item.sourceStatus==="unmonitored"||item.sourceStatus==="stale").length;
    dashboard.append(metric("Registered companies",companies.length || (companyDirectory.find((x)=>x.id===industry)?.companies?.length||0)),
      metric("Both agents reviewed",report.lastRunAt?checked:"Not run"),
      metric("Sources stale or missing",uncovered),
      metric("Consensus candidates",consensus.length));
    reportSummary.textContent="Research details · "+disagreement.length+" disagreements / "+consensus.length+" pending consensus candidates";
    const oldAudit=reportDetails.querySelector(".dual-company-audit");if(oldAudit)oldAudit.remove();
    if(companies.length){
      const audit=document.createElement("details");audit.className="dual-company-audit";
      const auditTitle=document.createElement("summary");auditTitle.textContent="Company-by-company coverage ("+checked+"/"+companies.length+")";
      audit.append(auditTitle);
      for(const company of companies){
        const item=document.createElement("div");item.className="dual-company-row";
        const name=document.createElement("strong");name.textContent=company.name||company.companyId;
        const source=document.createElement("small");source.textContent="Source status: "+sourceLabel(company.sourceStatus);
        item.append(name,source);
        item.append(field("Claude",company.claude?.summary||"Not run"));
        item.append(field("Codex",company.codex?.summary||"Not run"));
        audit.append(item);
      }
      reportDetails.insertBefore(audit,findings);
    }
    const timestamp = report.lastRunAt ? new Date(report.lastRunAt) : null;
    status.textContent=timestamp && Number.isFinite(timestamp.getTime()) ? "Last research: "+timestamp.toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}) : "No completed dual-agent research run";
    const ordered=[...consensus,...disagreement];
    if(!ordered.length){
      const empty=document.createElement("p");empty.className="dual-empty";
      empty.textContent="No candidate currently qualifies for escalation in this industry. This does not mean no developments occurred.";
      findings.append(empty);return;
    }
    for(const item of ordered.slice(0,20)){
      const card=document.createElement("article");card.className="dual-finding "+item.status;card.dataset.eventId=item.eventId;
      const top=document.createElement("div");top.className="dual-finding-top";
      const badge=document.createElement("span");badge.className="dual-finding-badge";badge.textContent=label[item.status]||item.status;
      const target=document.createElement("strong");target.textContent=item.target||item.eventId;
      top.append(badge,target);card.append(top);
      const summary=document.createElement("p");summary.textContent=item.summary;card.append(summary);
      if(item.origin==="human_nomination"){
        card.append(field("Research note",item.annotation));
        card.append(field("Proposed graph change",changeLabel(item.proposedGraphChange)));
      }
      const compare=document.createElement("details");compare.className="dual-compare";
      const toggler=document.createElement("summary");toggler.textContent="View independent Claude / Codex opinions and evidence";
      compare.append(toggler);
      compare.append(field("Claude Code · "+(verdictLabel(item.claude?.verdict)), item.claude?.rationale));
      compare.append(field("Codex · "+(verdictLabel(item.codex?.verdict)), item.codex?.rationale));
      compare.append(field("Verbatim evidence excerpt",item.claude?.evidenceExcerpt || item.codex?.evidenceExcerpt));
      card.append(compare);
      const bottom=document.createElement("div");bottom.className="dual-finding-actions";
      const source=safeLink(item.sourceUrl);
      if(source){const link=document.createElement("a");link.href=source;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Original source ↗";bottom.append(link);}
      if(item.origin==="human_nomination" && safeLink(item.issueUrl)){
        const nominationLink=document.createElement("a");nominationLink.href=item.issueUrl;
        nominationLink.target="_blank";nominationLink.rel="noopener noreferrer";nominationLink.textContent="View original nomination ↗";
        bottom.append(nominationLink);
      } else if(item.origin!=="human_nomination"){
        const view=document.createElement("button");view.type="button";view.textContent="View in update feed →";
        view.addEventListener("click",()=>openEvent(item.eventId,item.industryId));
        bottom.append(view);
      }
      card.append(bottom);findings.append(card);
    }
  }

  fetch("data/industries.json",{cache:"no-store"})
    .then((response)=>response.ok?response.json():[])
    .then((data)=>{companyDirectory=Array.isArray(data)?data:[];render();})
    .catch(()=>{});
  fetch("data/dual-agent-reviews.json",{cache:"no-store"})
    .then((response)=>response.ok?response.json():null)
    .then((data)=>{ report=data; render();
      const wanted=new URLSearchParams(location.search).get("event");
      const match=data?.findings?.find((item)=>item.eventId===wanted);
      if(match){
        if(match.origin==="human_nomination"){
          reportDetails.open=true;
          const card=[...findings.querySelectorAll(".dual-finding")].find((element)=>element.dataset.eventId===match.eventId);
          card?.scrollIntoView({behavior:"smooth",block:"center"});
          return;
        }
        const attempt=()=>{
          if(select?.options?.length && [...select.options].some((o)=>o.value===match.industryId)){
            openEvent(match.eventId,match.industryId);return true;
          }
          return false;
        };
        if(!attempt()){
          const observe=new MutationObserver(()=>{if(attempt())observe.disconnect()});
          if(select)observe.observe(select,{childList:true});
          setTimeout(()=>observe.disconnect(),10000);
        }
      }
    })
    .catch(()=>{status.textContent="Research results temporarily unavailable";});
  select?.addEventListener("change",render);
  if(select) new MutationObserver(render).observe(select,{childList:true});
})();
