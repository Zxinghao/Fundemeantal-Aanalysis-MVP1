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
  subtitle.textContent = "Claude Code × Codex · 每天逐一覆盖所有已登记行业和企业";
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
  note.textContent = "双模型一致不等于事实已核实。批准按钮首先保存浏览器本地决定，当前正式发布仍需执行 GitHub 的 Approve And Promote 工作流。";
  const actions = document.createElement("div");actions.className="dual-actions";
  const help = document.createElement("a");
  help.href = "https://github.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/actions/workflows/approve-and-promote.yml";
  help.target="_blank";help.rel="noopener noreferrer";help.textContent="前往人工审核发布工作流 ↗";
  actions.append(help);
  const reportDetails=document.createElement("details");
  reportDetails.className="dual-report-details";
  const reportSummary=document.createElement("summary");
  reportSummary.textContent="展开查看双 Agent 的证据、分歧和历史候选";
  reportDetails.append(reportSummary,findings,note,actions);
  panel.append(header,dashboard,reportDetails);
  grid.before(panel);

  let report = null;
  function safeLink(url) {
    try { const u=new URL(url); return ["http:","https:"].includes(u.protocol)?u.href:null; }
    catch { return null; }
  }
  const label = {
    consensus_candidate: "双模型共识候选 · 待人工核实",
    needs_evidence: "意见冲突 / 证据不足",
    non_material: "无重大产业链变化"
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
    const paragraph=document.createElement("p");paragraph.textContent=value || "未提供";
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
    if (!report) { status.textContent="无双模型研究记录";return; }
    const industry=select?.value;
    const items=(report.findings||[]).filter((item)=>item.industryId===industry);
    const consensus=items.filter((item)=>item.status==="consensus_candidate");
    const disagreement=items.filter((item)=>item.status==="needs_evidence");
    const sources=(report.coverage||[]).filter((item)=>item.industryId===industry);
    const companies=(report.companyCoverage||[]).filter((item)=>item.industryId===industry);
    const checked=companies.filter((item)=>item.claude && item.codex).length;
    const uncovered=companies.filter((item)=>item.sourceStatus==="unmonitored"||item.sourceStatus==="stale").length;
    dashboard.append(metric("本行业已登记企业",companies.length),
      metric("双 Agent 已逐一处理",report.lastRunAt?checked:"未运行"),
      metric("缺少近期资料",uncovered),
      metric("共识候选",consensus.length));
    reportSummary.textContent="研究详情 · "+disagreement.length+" 条争议 / "+consensus.length+" 条待核实共识";
    const oldAudit=reportDetails.querySelector(".dual-company-audit");if(oldAudit)oldAudit.remove();
    if(companies.length){
      const audit=document.createElement("details");audit.className="dual-company-audit";
      const auditTitle=document.createElement("summary");auditTitle.textContent="逐公司研究覆盖清单（"+checked+"/"+companies.length+"）";
      audit.append(auditTitle);
      for(const company of companies){
        const item=document.createElement("div");item.className="dual-company-row";
        const name=document.createElement("strong");name.textContent=company.name||company.companyId;
        const source=document.createElement("small");source.textContent="来源状态："+company.sourceStatus;
        item.append(name,source);
        item.append(field("Claude",company.claude?.summary||"未运行"));
        item.append(field("Codex",company.codex?.summary||"未运行"));
        audit.append(item);
      }
      reportDetails.insertBefore(audit,findings);
    }
    const timestamp = report.lastRunAt ? new Date(report.lastRunAt) : null;
    status.textContent=timestamp && Number.isFinite(timestamp.getTime()) ? "上次研究："+timestamp.toLocaleString("zh-CN") : "尚未执行双模型研究";
    const ordered=[...consensus,...disagreement];
    if(!ordered.length){
      const empty=document.createElement("p");empty.className="dual-empty";
      empty.textContent="目前该行业没有需要升级的双模型研究候选；这不代表行业没有新事件。";
      findings.append(empty);return;
    }
    for(const item of ordered.slice(0,20)){
      const card=document.createElement("article");card.className="dual-finding "+item.status;
      const top=document.createElement("div");top.className="dual-finding-top";
      const badge=document.createElement("span");badge.className="dual-finding-badge";badge.textContent=label[item.status]||item.status;
      const target=document.createElement("strong");target.textContent=item.target||item.eventId;
      top.append(badge,target);card.append(top);
      const summary=document.createElement("p");summary.textContent=item.summary;card.append(summary);
      if(item.origin==="human_nomination"){
        card.append(field("人工批注",item.annotation));
        card.append(field("拟评估的结构变化",item.proposedGraphChange));
      }
      const compare=document.createElement("details");compare.className="dual-compare";
      const toggler=document.createElement("summary");toggler.textContent="查看 Claude / Codex 独立意见与证据";
      compare.append(toggler);
      compare.append(field("Claude Code · "+(item.claude?.verdict||"未验证"), item.claude?.rationale));
      compare.append(field("Codex · "+(item.codex?.verdict||"未验证"), item.codex?.rationale));
      compare.append(field("证据节选（原文）",item.claude?.evidenceExcerpt || item.codex?.evidenceExcerpt));
      card.append(compare);
      const bottom=document.createElement("div");bottom.className="dual-finding-actions";
      const source=safeLink(item.sourceUrl);
      if(source){const link=document.createElement("a");link.href=source;link.target="_blank";link.rel="noopener noreferrer";link.textContent="原始来源 ↗";bottom.append(link);}
      if(item.origin==="human_nomination" && safeLink(item.issueUrl)){
        const nominationLink=document.createElement("a");nominationLink.href=item.issueUrl;
        nominationLink.target="_blank";nominationLink.rel="noopener noreferrer";nominationLink.textContent="查看原始提名 ↗";
        bottom.append(nominationLink);
      } else if(item.origin!=="human_nomination"){
        const view=document.createElement("button");view.type="button";view.textContent="在消息中查看 →";
        view.addEventListener("click",()=>openEvent(item.eventId,item.industryId));
        bottom.append(view);
      }
      card.append(bottom);findings.append(card);
    }
  }

  fetch("data/dual-agent-reviews.json",{cache:"no-store"})
    .then((response)=>response.ok?response.json():null)
    .then((data)=>{ report=data; render();
      const wanted=new URLSearchParams(location.search).get("event");
      const match=data?.findings?.find((item)=>item.eventId===wanted);
      if(match){
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
    .catch(()=>{status.textContent="研究结果暂时不可用";});
  select?.addEventListener("change",render);
  if(select) new MutationObserver(render).observe(select,{childList:true});
})();
