/* Mobile-first experience. Research/scoring business logic remains untouched. */
(() => {
  "use strict";
  const layout=document.querySelector("main.layout");
  if(!layout)return;
  layout.id="experience-layout"; layout.dataset.screen="explore";
  const explorer=layout.querySelector(":scope > aside.panel");
  if(explorer)explorer.classList.add("explorer-panel");
  const nav=document.createElement("nav");
  nav.className="experience-nav";nav.setAttribute("aria-label","主要功能");
  nav.innerHTML='<button type="button" class="experience-tab is-active" data-screen="explore" aria-pressed="true"><span>◎</span><strong>产业链</strong><small>Explore</small></button>'+
    '<button type="button" class="experience-tab" data-screen="manufacture" aria-pressed="false"><span>▦</span><strong>制造流程</strong><small>How it is made</small></button>'+
    '<button type="button" class="experience-tab" data-screen="research" aria-pressed="false"><span>◫</span><strong>研究台</strong><small>Research</small></button>';
  layout.before(nav);
  nav.addEventListener("click",function(event){
    const tab=event.target.closest("[data-screen]");if(!tab)return;
    layout.dataset.screen=tab.dataset.screen;
    nav.querySelectorAll("[data-screen]").forEach(function(button){
      const active=button===tab;button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    window.scrollTo({top:0,behavior:"instant"});
  });
  const intro=document.createElement("div");
  intro.className="mobile-chain-intro";
  intro.innerHTML='<div><p class="mini-kicker">SUPPLY CHAIN</p><h3>按层级探索产业链</h3><p>展开每层节点，点击查看公司、技术角色和证据。</p></div><span id="mobile-chain-count"></span>';
  const list=document.createElement("div");list.id="mobile-node-list";list.className="mobile-node-list";
  const map=document.querySelector("#supply-chain-map");
  if(map){map.before(intro);map.before(list)}
  if(explorer){
    const toggle=document.createElement("button");
    toggle.type="button";toggle.id="method-toggle";toggle.className="method-toggle";
    toggle.textContent="研究方法与图例  +";toggle.setAttribute("aria-expanded","false");
    explorer.querySelector(".method-card")?.before(toggle);
    toggle.addEventListener("click",function(){
      const open=explorer.classList.toggle("show-method");
      toggle.textContent=open?"收起研究方法  −":"研究方法与图例  +";
      toggle.setAttribute("aria-expanded",String(open));
    });
  }
  const SOURCE={
    nv:"https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/",
    supplier:"https://images.nvidia.com/aem-dam/Solutions/documents/NVIDIA-Sustainability-Report-Fiscal-Year-2025.pdf",
    cowos:"https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm",
    inventory:"https://epoch.ai/data/ai-chip-components-documentation/methodology",
    system:"https://docs.nvidia.com/multi-node-nvlink-systems/multi-node-tuning-guide/overview.html"
  };
  const stages=[
    ["芯片架构设计","Architecture & tape-out","设计阶段","计算需求、EDA 工具与芯片 IP","NVIDIA 设计计算单元、内存互连和电路布局，完成验证并形成流片数据。","可交付晶圆厂的芯片设计文件","NVIDIA；EDA 生态（例如 Cadence、Synopsys，不代表某型号确认采购）","验证周期、设计复杂度和工艺适配","官方确认 Blackwell 采用双芯粒架构及 TSMC 定制 4NP 工艺。","nv"],
    ["材料与设备","Materials & equipment","上游投入","高纯硅、300mm 硅片、光刻胶、特种气体、超纯水、生产设备","提供光刻、沉积、刻蚀、检测所需的材料和设备，晶圆厂对其进行长期认证。","晶圆制造所需的合格材料与工艺能力","设备示例：ASML、Applied Materials、Tokyo Electron；不是特定 GPU 供应商名单","高端设备交付、耗材品质、资格认证","此处是工艺通用依赖，不能证明任何单一企业已经取得 NVIDIA 订单。","nv"],
    ["先进晶圆制造","Wafer fabrication","核心制造","芯片设计、光罩、硅晶圆、设备与化学材料","反复执行光刻、沉积、刻蚀等工序，在晶圆上制造晶体管和金属互连。","包含 GPU 芯粒的已加工晶圆","TSMC（Blackwell 定制 4NP，官方确认）","先进制程产能、良率与地理集中度","NVIDIA 官方明确确认 Blackwell GPU 使用 TSMC 4NP。","nv"],
    ["晶圆测试和切割","Wafer sort & singulation","良率控制","加工后的晶圆、探针和测试设备","测试各芯粒的功能及电性，筛选并切割合格芯粒。","已筛选的 GPU 芯粒（known-good dies）","晶圆代工及测试服务生态；具体外包分工未核实","晶圆良率、测试覆盖率、缺陷损耗","这是一般半导体生产流程，非指定厂商合同证据。","inventory"],
    ["HBM 存储制造","HBM — parallel stream","并行供应链","DRAM 晶圆、TSV、薄化与堆叠技术","多层 DRAM 制造并垂直堆叠为高带宽存储；与 GPU 晶圆制造并行进行，在后续封装阶段汇合。","通过测试的 HBM 堆叠","SK hynix、Micron、Samsung（已披露内存供应商，不代表每款产品由三家同时供货）","HBM 良率、认证、交期和产能","NVIDIA 披露上述内存供应商，但未在该资料中逐型号分配。","supplier"],
    ["CoWoS 先进封装","Advanced packaging","关键汇合点","GPU 逻辑芯粒、HBM、中介层、封装基板","以高密度互连集成 GPU 和 HBM，完成芯片封装、连接及测试。","高性能 GPU 封装","TSMC CoWoS 生态；Blackwell 主要采用 CoWoS-L","封装产能、中介层、基板、组装良率","TSMC 官方说明 CoWoS-L 的芯片异构集成能力；实时瓶颈需另行核实。","cowos"],
    ["加速模块组装","Accelerator module","板卡制造","GPU 封装、PCB、供电、电容、连接器和散热组件","将封装芯片组装为加速模块，写入固件并进行电气与热测试。","可安装到计算系统的加速模块","电子制造和模块集成生态；具体供货商待逐型号核实","高功耗供电、热设计、板卡及封装基板供应","本节点不将潜在供应商写成已核实供应关系。","inventory"],
    ["服务器与机柜集成","System integration","系统制造","GPU 模块、CPU、网络、交换机、电源、液冷、机柜","整合 GPU、CPU、高速网络、电源与液冷形成 AI 服务器及机柜。","可部署的 AI 计算系统","NVIDIA 披露过 Hon Hai/Foxconn、Wistron、Fabrinet 等制造合作方；非所有 SKU 确认","电力、冷却、网络互连和系统验收","披露了合同制造合作方，但未给出每款机柜的完整分工。","supplier"],
    ["验收与算力交付","Bring-up & deployment","最终交付","完整系统、驱动、固件、测试工作负载","进行性能、功耗、热和互连稳定性测试，完成软件配置及数据中心部署。","可运行 AI 训练和推理的算力","系统集成商、数据中心与软件生态","数据中心供电能力和散热基础设施","芯片完工不等于服务器已部署，更不等于实际算力已上线。","system"]
  ];
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  })}
  const section=document.createElement("section");section.id="gpu-manufacturing";
  section.className="manufacturing-panel";section.setAttribute("aria-label","GPU 制造流程");
  section.innerHTML='<div class="manufacturing-head"><p class="mini-kicker">PRODUCT DEEP DIVE · 01</p>'+
    '<h2>一块 NVIDIA AI GPU<br><span>是怎样制造出来的？</span></h2>'+
    '<p>以 Blackwell 架构为研究样本，逐步追踪设计、晶圆、HBM、先进封装及整机交付。每一步显示投入、加工过程、产出、产业参与者及证据边界。</p>'+
    '<div class="product-summary"><div><strong>Blackwell-class AI GPU</strong><small>研究样本 · 非特定 SKU 的完整物料清单</small></div><span>9 个制造环节</span></div></div>'+
    '<div class="process-overview"><span>设计</span><b>→</b><span>晶圆</span><b>＋</b><span>HBM</span><b>→</b><span>CoWoS</span><b>→</b><span>整机</span></div>'+
    '<div class="gpu-step-layout"><aside class="gpu-step-rail"><div class="step-rail-heading"><strong>制造步骤</strong><small id="gpu-stage-progress">01 / 09</small></div><div id="gpu-step-list" class="gpu-step-list"></div></aside>'+
    '<article class="gpu-step-detail" id="gpu-step-detail" aria-live="polite"></article></div>'+
    '<div class="gpu-method-note"><strong>技术瓶颈 ≠ 投资机会</strong><p>技术不可替代、产能受限与利润增长是三个不同命题；具体供应关系、供需变化及估值必须单独核实。</p>'+
    '<div class="gpu-sources"><a href="'+SOURCE.nv+'" target="_blank" rel="noopener noreferrer">NVIDIA 官方资料 ↗</a>'+
    '<a href="'+SOURCE.cowos+'" target="_blank" rel="noopener noreferrer">TSMC CoWoS ↗</a>'+
    '<a href="https://m.youtube.com/watch?v=sDUVPH7eJzU" target="_blank" rel="noopener noreferrer">你提供的参考视频 ↗</a></div></div>';
  layout.insertBefore(section,layout.querySelector(".updates-panel"));
  const stageList=section.querySelector("#gpu-step-list");
  const stageDetail=section.querySelector("#gpu-step-detail");
  let selectedStage=0;
  function renderStage(next){
    selectedStage=Math.min(Math.max(next,0),stages.length-1);
    const s=stages[selectedStage];
    section.querySelector("#gpu-stage-progress").textContent=String(selectedStage+1).padStart(2,"0")+" / "+String(stages.length).padStart(2,"0");
    stageList.innerHTML=stages.map(function(st,i){
      return '<button type="button" data-stage="'+i+'" class="gpu-step-button'+(i===selectedStage?' is-current':'')+'" aria-current="'+(i===selectedStage?'step':'false')+'"><span>'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(st[0])+'</strong></button>';
    }).join("");
    const box=function(label,value,extra){return '<div class="step-box '+(extra||'')+'"><span>'+label+'</span><p>'+esc(value)+'</p></div>'};
    stageDetail.innerHTML='<div class="step-detail-top"><span class="step-category">'+esc(s[2])+'</span><span>STEP '+String(selectedStage+1).padStart(2,"0")+' / 09</span></div>'+
      '<h3>'+esc(s[0])+'</h3><p class="step-en">'+esc(s[1])+'</p>'+
      '<div class="step-process">'+box('01 · 投入 INPUT',s[3])+box('02 · 制作 PROCESS',s[4],'primary')+box('03 · 产出 OUTPUT',s[5])+'</div>'+
      '<div class="step-analysis"><div><h4>产业参与者</h4><p>'+esc(s[6])+'</p></div><div><h4>关键约束 / 待核实</h4><p>'+esc(s[7])+'</p></div></div>'+
      '<div class="step-fact"><strong>证据边界</strong><p>'+esc(s[8])+'</p><a href="'+SOURCE[s[9]]+'" target="_blank" rel="noopener noreferrer">查看资料来源 ↗</a></div>'+
      '<div class="step-controls"><button type="button" data-shift="-1" '+(selectedStage===0?'disabled':'')+'>← 上一步</button>'+
      '<button type="button" data-shift="1" '+(selectedStage===stages.length-1?'disabled':'')+'>下一步 →</button></div>';
  }
  stageList.addEventListener("click",function(event){const b=event.target.closest("[data-stage]");if(b)renderStage(Number(b.dataset.stage))});
  stageDetail.addEventListener("click",function(event){const b=event.target.closest("[data-shift]");if(b)renderStage(selectedStage+Number(b.dataset.shift))});
  renderStage(0);
  let industries=[];
  const select=document.querySelector("#industry-select");
  function renderMobileList(){
    const industry=industries.find(function(x){return x.id===select.value})||industries[0];
    if(!industry)return;
    document.querySelector("#mobile-chain-count").textContent=industry.nodes.length+" 个节点";
    const groups=new Map();
    industry.nodes.slice().sort(function(a,b){return a.position.x-b.position.x||a.position.y-b.position.y}).forEach(function(node){
      const key=node.position.x;if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(node);
    });
    list.innerHTML=Array.from(groups.values()).map(function(nodes,index){
      const heading=index===0?"终端需求":"供应链第 "+(index+1)+" 层";
      const cards=nodes.map(function(node){
        return '<button type="button" class="mobile-node-card '+esc(node.type)+'" data-node-title="'+esc(node.title)+'"><span class="mobile-node-dot"></span>'+
          '<span class="mobile-node-text"><strong>'+esc(node.title)+'</strong><small>'+esc(node.layer)+'</small></span><span class="mobile-node-open">›</span></button>';
      }).join("");
      return '<details class="mobile-chain-layer" '+(index<2?'open':'')+'><summary><span class="layer-index">'+String(index+1).padStart(2,"0")+
        '</span><strong>'+heading+'</strong><span class="layer-count">'+nodes.length+' 节点</span><span class="layer-chevron">⌄</span></summary><div class="mobile-layer-items">'+cards+'</div></details>';
    }).join("");
  }
  list.addEventListener("click",function(event){
    const b=event.target.closest("[data-node-title]");if(!b)return;
    const target=Array.from(document.querySelectorAll("#supply-chain-map .node")).find(function(node){
      return node.querySelector(".node-title")?.textContent===b.dataset.nodeTitle;
    });
    if(target)target.click();
  });
  select?.addEventListener("change",function(){queueMicrotask(renderMobileList)});
  fetch("data/industries.json",{cache:"no-store"})
    .then(function(r){return r.ok?r.json():[]})
    .then(function(data){industries=Array.isArray(data)?data:[];renderMobileList()})
    .catch(function(){list.innerHTML='<p class="load-error">产业链数据加载失败。</p>'});
})();
