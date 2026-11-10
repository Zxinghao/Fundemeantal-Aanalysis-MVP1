/* "How it's made" product journeys.
   Presentation only: reads data/products.json and never touches scoring,
   scanner, or review data. Each step pairs an animated SVG scene with an
   input → process → output explanation and explicit evidence boundaries. */
(function productJourney() {
  "use strict";

  const root = document.querySelector("#product-journey");
  if (!root) return;

  const STEP_MS = 7000;
  const C = {
    line: "#2a3558",
    panel: "#141c38",
    steel: "#9fb0d0",
    green: "#6ee7a8",
    cyan: "#5cc8ff",
    amber: "#ffc46b",
    violet: "#b79cff",
    red: "#ff7a70"
  };

  let products = [];
  let product = null;
  let index = 0;
  let playing = false;
  let timer = null;

  fetch("data/products.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((data) => {
      products = Array.isArray(data) ? data : [];
      renderList();
      watchDetailDialog();
    })
    .catch(() => {
      root.innerHTML = `<div class="card"><p class="empty-state">产品制造数据加载失败，请刷新重试。</p></div>`;
    });

  document.addEventListener("radar:view", (event) => {
    if (event.detail.view !== "made") stopAutoplay();
  });

  document.addEventListener("keydown", (event) => {
    if (!product || document.body.dataset.view !== "made") return;
    if (event.target.closest("input, textarea, select")) return;
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  });

  // ---------- Product list ----------

  function renderList() {
    stopAutoplay();
    product = null;
    root.innerHTML = `
      <div class="jr-intro">
        <h2>产品是怎么造出来的</h2>
        <p class="lede">选一个产品，用一步一步的动画看懂它的制造流程，以及每一步卡在哪里。</p>
      </div>
      <div class="jr-products">
        ${products.map((item) => `
          <button type="button" class="jr-product" data-product="${esc(item.id)}">
            <span class="jr-product-art" aria-hidden="true">${chipArt()}</span>
            <span class="jr-product-text">
              <small>${esc(item.variant || "")}</small>
              <strong>${esc(item.name)}</strong>
              <span>${esc(item.summary || "")}</span>
            </span>
            <span class="jr-facts">
              ${(item.facts || []).map((fact) => `<span><b>${esc(fact.value)}</b>${esc(fact.label)}</span>`).join("")}
            </span>
            <span class="jr-product-go">${esc(item.duration || "")}<b>开始 ›</b></span>
          </button>
        `).join("") || `<p class="empty-state">还没有产品。</p>`}
      </div>
    `;
    root.querySelectorAll("[data-product]").forEach((button) => {
      button.addEventListener("click", () => open(button.dataset.product));
    });
  }

  function chipArt() {
    let pins = "";
    for (let i = 0; i < 5; i += 1) {
      const p = 24 + i * 13;
      pins += `<path d="M${p} 6v10M${p} 84v10M6 ${p}h10M84 ${p}h10" stroke="${C.steel}" stroke-width="3" stroke-linecap="round"/>`;
    }
    return `<svg viewBox="0 0 100 100">${pins}
      <rect x="16" y="16" width="68" height="68" rx="8" fill="${C.panel}" stroke="${C.green}" stroke-width="2"/>
      <rect x="28" y="30" width="20" height="40" rx="2" fill="${C.green}" fill-opacity=".7"/>
      <rect x="52" y="30" width="20" height="40" rx="2" fill="${C.green}" fill-opacity=".7"/></svg>`;
  }

  // ---------- Journey ----------

  function open(productId, startIndex = 0) {
    product = products.find((item) => item.id === productId) || null;
    if (!product) return;
    index = startIndex;

    root.innerHTML = `
      <div class="jr">
        <div class="jr-top">
          <button type="button" class="ghost jr-back">‹ 全部产品</button>
          <div><strong>${esc(product.name)}</strong><small>${esc(product.variant || "")}</small></div>
        </div>
        <ol class="jr-rail" aria-label="制造步骤">
          ${product.steps.map((step, i) => `
            <li><button type="button" data-step="${i}"><b>${i + 1}</b><span>${esc(step.short || step.title)}</span></button></li>
          `).join("")}
        </ol>
        <div class="jr-stage" role="img" tabindex="0">
          <div class="jr-scene"></div>
          <span class="jr-count"></span>
          <span class="jr-hint">点画面重播 · 左右滑动换步</span>
          <div class="jr-progress"><i></i></div>
        </div>
        <div class="jr-controls">
          <button type="button" class="ghost" data-act="prev" aria-label="上一步">‹ 上一步</button>
          <button type="button" class="ghost" data-act="play">▶ 自动播放</button>
          <button type="button" data-act="next" aria-label="下一步">下一步 ›</button>
        </div>
        <article class="card jr-body" aria-live="polite"></article>
      </div>
    `;

    root.querySelector(".jr-back").addEventListener("click", renderList);
    root.querySelector(".jr-rail").addEventListener("click", (event) => {
      const button = event.target.closest("[data-step]");
      if (button) go(Number(button.dataset.step));
    });
    root.querySelector(".jr-controls").addEventListener("click", (event) => {
      const action = event.target.closest("[data-act]")?.dataset.act;
      if (action === "prev") go(index - 1);
      if (action === "next") go(index + 1);
      if (action === "play") (playing ? stopAutoplay() : startAutoplay());
    });
    root.querySelector(".jr-body").addEventListener("click", (event) => {
      if (event.target.closest("[data-act='next']")) go(index + 1, true);
      if (event.target.closest("[data-act='restart']")) go(0, true);
      if (event.target.closest("[data-act='related']")) openRelatedIndustry();
    });
    bindStageGestures(root.querySelector(".jr-stage"));
    renderStep();
    window.scrollTo(0, 0);
  }

  function go(nextIndex, scrollToStage = false) {
    if (!product) return;
    if (nextIndex < 0 || nextIndex >= product.steps.length) return;
    index = nextIndex;
    renderStep();
    if (playing) scheduleAutoplay();
    if (scrollToStage) root.querySelector(".jr-rail")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function renderStep() {
    const step = product.steps[index];
    const total = product.steps.length;
    const last = index === total - 1;

    root.querySelectorAll("[data-step]").forEach((button, i) => {
      button.classList.toggle("done", i < index);
      if (i === index) {
        button.setAttribute("aria-current", "step");
        button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      } else {
        button.removeAttribute("aria-current");
      }
    });

    playScene();
    const stage = root.querySelector(".jr-stage");
    stage.setAttribute("aria-label", `第 ${index + 1} 步动画：${step.title}。${step.tagline}`);
    root.querySelector(".jr-count").textContent = `${index + 1} / ${total}`;
    root.querySelector("[data-act='prev']").disabled = index === 0;
    root.querySelector(".jr-controls [data-act='next']").disabled = last;

    const sources = (step.sourceIds || [])
      .map((id) => (product.sources || []).find((source) => source.id === id))
      .filter(Boolean);

    root.querySelector(".jr-body").innerHTML = `
      <p class="eyebrow">第 ${index + 1} 步 · ${esc(step.en || "")}</p>
      <h2>${esc(step.title)}</h2>
      <p class="jr-tagline">${esc(step.tagline)}</p>

      <div class="jr-io">
        <div><small>输入</small><span>${esc(step.input)}</span></div>
        <div><small>过程</small><span>${esc(step.process)}</span></div>
        <div><small>产出</small><span>${esc(step.output)}</span></div>
      </div>

      <h3>谁在做</h3>
      <div class="jr-players">
        ${(step.players || []).map((player) => `
          <span class="${player.confirmed ? "confirmed" : ""}">
            <b>${esc(player.name)}</b>${esc(player.role || "")}${player.confirmed ? "<i>✓ 官方确认</i>" : ""}
          </span>
        `).join("")}
      </div>
      <p class="jr-note">未标“官方确认”的为行业代表企业，不代表已确认的供货关系。</p>

      <div class="jr-callout">
        <strong>瓶颈观察</strong>
        <p>${esc(step.bottleneck)}</p>
      </div>

      <details class="jr-evidence">
        <summary>证据与边界</summary>
        <p>${esc(step.evidence)}</p>
        ${sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}
      </details>

      ${last ? `
        ${product.relatedIndustry ? `<button type="button" class="jr-next" data-act="related">${esc(product.relatedIndustry.label)} ›</button>` : ""}
        <button type="button" class="ghost jr-next" data-act="restart">↺ 从第 1 步再看一遍</button>
        <p class="jr-note">${esc(product.disclaimer || "")}</p>
      ` : `
        <button type="button" class="jr-next" data-act="next">下一步：${esc(product.steps[index + 1].title)} ›</button>
      `}
    `;
  }

  function playScene() {
    const step = product.steps[index];
    const draw = scenes[step.scene];
    const holder = root.querySelector(".jr-scene");
    holder.innerHTML = draw ? frame(draw()) : "";
    const bar = root.querySelector(".jr-progress i");
    bar.classList.remove("run");
    if (playing) {
      void bar.offsetWidth; // restart the CSS animation
      bar.style.animationDuration = `${STEP_MS}ms`;
      bar.classList.add("run");
    }
  }

  function startAutoplay() {
    playing = true;
    if (index === product.steps.length - 1) index = 0;
    root.querySelector("[data-act='play']").textContent = "❚❚ 暂停";
    renderStep();
    scheduleAutoplay();
  }

  function scheduleAutoplay() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!product || index >= product.steps.length - 1) {
        stopAutoplay();
        return;
      }
      index += 1;
      renderStep();
      scheduleAutoplay();
    }, STEP_MS);
  }

  function stopAutoplay() {
    playing = false;
    clearTimeout(timer);
    const button = root.querySelector("[data-act='play']");
    if (button) button.textContent = "▶ 自动播放";
    root.querySelector(".jr-progress i")?.classList.remove("run");
  }

  function bindStageGestures(stage) {
    let startX = null;
    let startY = null;
    let swiped = false;

    stage.addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      swiped = false;
    }, { passive: true });

    stage.addEventListener("touchend", (event) => {
      if (startX === null) return;
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped = true;
        go(index + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });

    stage.addEventListener("click", () => {
      if (swiped) {
        swiped = false;
        return;
      }
      playScene();
      if (playing) scheduleAutoplay();
    });

    stage.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playScene();
      }
    });
  }

  function openRelatedIndustry() {
    const app = globalThis.RadarApp;
    if (!app || !product?.relatedIndustry) return;
    app.selectIndustry(product.relatedIndustry.id);
    app.showView("chain");
  }

  // ---------- Entry point from supply-chain detail dialogs ----------

  function watchDetailDialog() {
    const detail = document.querySelector("#company-detail");
    const dialog = document.querySelector("#company-dialog");
    if (!detail || !dialog) return;

    const inject = () => {
      const header = detail.querySelector(".detail-header");
      const name = header?.querySelector("h2")?.textContent?.trim();
      const match = products.find((item) => (item.linkedNames || []).includes(name));
      const existing = detail.querySelector(".jr-cta");
      if (!header || !match) {
        existing?.remove();
        return;
      }
      if (existing?.dataset.product === match.id) return;
      existing?.remove();

      const button = document.createElement("button");
      button.type = "button";
      button.className = "jr-cta";
      button.dataset.product = match.id;
      button.textContent = `▶ 看 ${match.name} 是怎么造出来的（${match.steps.length} 步动画）`;
      button.addEventListener("click", () => {
        dialog.close();
        globalThis.RadarApp?.showView("made");
        open(match.id);
      });
      header.insertAdjacentElement("afterend", button);
    };

    new MutationObserver(inject).observe(detail, { childList: true, subtree: true });
  }

  // ---------- Scenes (viewBox 360 × 220) ----------

  function frame(inner) {
    return `<svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;
  }

  function d(seconds) {
    return `--d:${seconds.toFixed(2)}s`;
  }

  function text(x, y, value, options = {}) {
    const { cls = "t", anchor = "middle", delay = null, fill = "" } = options;
    const styles = [];
    if (fill) styles.push(`fill:${fill}`);
    if (delay !== null) styles.push(d(delay));
    const fade = delay === null ? "" : " a-fade";
    return `<text x="${x}" y="${y}" class="${cls}${fade}" text-anchor="${anchor}"${styles.length ? ` style="${styles.join(";")}"` : ""}>${esc(value)}</text>`;
  }

  const scenes = {
    design() {
      let out = "";
      const blocks = [
        [6, 6, 46, 30, C.cyan], [56, 6, 48, 30, C.violet], [6, 40, 30, 64, C.amber],
        [40, 40, 64, 30, C.green], [40, 74, 30, 30, C.cyan], [74, 74, 30, 30, C.violet]
      ];
      [60, 190].forEach((x, i) => {
        out += `<rect class="a-draw" style="--len:440;${d(i * 0.3)}" x="${x}" y="30" width="110" height="110" rx="6" fill="none" stroke="${C.green}" stroke-width="1.5"/>`;
        blocks.forEach(([bx, by, w, h, color], k) => {
          out += `<rect class="a-fade" style="${d(0.8 + i * 0.25 + k * 0.18)}" x="${x + bx}" y="${30 + by}" width="${w}" height="${h}" rx="2" fill="${color}" fill-opacity=".55"/>`;
        });
        out += text(x + 55, 156, `芯粒 ${i + 1}`, { cls: "t s", delay: 0.6 + i * 0.3 });
      });
      [62, 85, 108].forEach((y) => {
        out += `<path class="a-fade a-flow" style="${d(2.4)}" d="M170 ${y}H190" stroke="${C.cyan}" stroke-width="2"/>`;
      });
      out += text(180, 24, "高速互连 10 TB/s", { cls: "t s", delay: 2.4, fill: C.cyan });
      out += text(180, 184, "2 颗芯粒 = 1 颗 GPU · 2080 亿晶体管", { cls: "t b", delay: 2.8 });
      out += text(180, 204, "版图文件 → 交给晶圆厂", { cls: "t s", delay: 3.3 });
      return out;
    },

    wafer() {
      let out = "";
      // 1. crystal pulling
      out += `<path d="M28 148 40 192H100L112 148Z" fill="${C.panel}" stroke="${C.steel}" stroke-width="1.5"/>`;
      out += `<path class="a-pulse" d="M33 160 40 188H100L107 160Z" fill="${C.amber}" fill-opacity=".8"/>`;
      out += `<path d="M70 18V70" stroke="${C.steel}" stroke-width="2"/>`;
      out += `<rect class="a-grow" style="--dur:1.8s;${d(0.2)}" x="57" y="68" width="26" height="96" rx="9" fill="${C.steel}"/>`;
      out += text(70, 212, "① 拉出单晶硅棒", { cls: "t s" });
      out += text(126, 124, "→", { cls: "t b", delay: 2 });
      // 2. slicing
      out += `<rect class="a-fade" style="${d(2)}" x="142" y="98" width="80" height="32" rx="7" fill="${C.steel}"/>`;
      for (let k = 0; k < 6; k += 1) {
        out += `<path class="a-fade" style="${d(2.5 + k * 0.18)}" d="M${154 + k * 11.5} 92V136" stroke="#0b1020" stroke-width="2.5"/>`;
      }
      out += `<path class="a-fade a-pulse" style="${d(2.5)}" d="M148 88H216" stroke="${C.amber}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      out += text(182, 212, "② 切成薄片", { cls: "t s", delay: 2 });
      out += text(238, 124, "→", { cls: "t b", delay: 3.6 });
      // 3. polished wafer
      out += `<g class="a-fade" style="${d(3.8)}">
        <circle cx="298" cy="114" r="44" fill="#8796bd"/>
        <circle cx="298" cy="114" r="44" fill="url(#jr-shine)"/>
        <path d="M294 158h8l-4-5z" fill="#0b1020"/>
        <circle class="a-pulse" cx="298" cy="114" r="48" fill="none" stroke="${C.cyan}" stroke-width="1"/>
      </g>`;
      out += `<defs><linearGradient id="jr-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
      out += text(298, 212, "③ 抛光 · 300mm 晶圆", { cls: "t s", delay: 3.8 });
      return out;
    },

    litho() {
      let out = "";
      out += `<rect x="146" y="8" width="68" height="20" rx="5" fill="${C.panel}" stroke="${C.violet}" stroke-width="1.5"/>`;
      out += text(180, 22, "EUV 光源", { cls: "t s", fill: C.violet });
      out += `<path class="a-pulse" d="M166 28h28l22 34h-72z" fill="${C.violet}" fill-opacity=".4"/>`;
      // mask
      out += `<rect x="128" y="62" width="104" height="9" fill="${C.steel}"/>`;
      [140, 158, 172, 190, 208].forEach((x) => {
        out += `<rect x="${x}" y="62" width="8" height="9" fill="#0b1020"/>`;
      });
      out += text(240, 70, "光罩（电路图案）", { cls: "t s", anchor: "start" });
      out += `<path class="a-pulse" d="M150 71h60l-18 32h-24z" fill="${C.violet}" fill-opacity=".4"/>`;
      // optics
      out += `<ellipse cx="180" cy="109" rx="36" ry="8" fill="${C.cyan}" fill-opacity=".18" stroke="${C.cyan}" stroke-width="1.5"/>`;
      out += text(224, 113, "镜组 · 缩小 4 倍", { cls: "t s", anchor: "start" });
      out += `<path class="a-pulse" d="M172 117h16l8 42h-32z" fill="${C.violet}" fill-opacity=".55"/>`;
      // wafer stage steps under the beam
      let stage = `<rect x="150" y="159" width="190" height="22" rx="4" fill="${C.panel}" stroke="${C.steel}"/>`;
      for (let k = 0; k < 5; k += 1) {
        const x = 165 + k * 36;
        stage += `<rect x="${x}" y="163" width="30" height="14" rx="2" fill="${C.line}"/>`;
        stage += `<rect class="a-fade" style="${d(0.5 + k)}" x="${x}" y="163" width="30" height="14" rx="2" fill="${C.violet}"/>`;
      }
      out += `<g class="a-step">${stage}</g>`;
      out += text(180, 204, "晶圆一格一格移动 · 逐格曝光", { cls: "t s" });
      out += text(16, 22, "波长 13.5nm", { cls: "t s", anchor: "start", fill: C.violet });
      return out;
    },

    layers() {
      let out = "";
      // process loop
      ["沉积", "光刻", "刻蚀"].forEach((label, k) => {
        const y = 40 + k * 44;
        out += `<rect x="24" y="${y}" width="76" height="26" rx="13" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>`;
        out += `<rect class="a-cycle" style="${d(k)}" x="24" y="${y}" width="76" height="26" rx="13" fill="${C.green}"/>`;
        out += text(62, y + 17, label, { cls: "t b" });
        if (k < 2) out += text(62, y + 39, "↓", { cls: "t s" });
      });
      out += `<path class="a-flow" d="M24 141H10V53H22" fill="none" stroke="${C.green}" stroke-width="1.5"/>`;
      out += text(62, 178, "循环数百次", { cls: "t s", fill: C.green });
      // cross-section
      const x0 = 150;
      const w = 190;
      out += `<rect x="${x0}" y="184" width="${w}" height="22" fill="#3b4a78"/>`;
      out += text(x0 - 6, 199, "硅衬底", { cls: "t s", anchor: "end" });
      for (let k = 0; k < 13; k += 1) {
        out += `<rect class="a-grow" style="--dur:.4s;${d(0.3 + k * 0.05)}" x="${x0 + 8 + k * 14}" y="174" width="7" height="10" fill="${C.green}"/>`;
      }
      out += text(x0 - 6, 182, "晶体管", { cls: "t s", anchor: "end", delay: 0.3, fill: C.green });
      const widths = [[10, 22, 14, 30, 18, 26], [28, 40, 22, 46], [50, 60, 44], [80, 76], [170]];
      widths.forEach((row, i) => {
        const y = 174 - (i + 1) * 22;
        const t = 1.2 + i * 0.9;
        out += `<rect class="a-fade" style="${d(t)}" x="${x0}" y="${y}" width="${w}" height="22" fill="${C.panel}" stroke="${C.line}"/>`;
        let x = x0 + 8;
        const gap = (w - 16 - row.reduce((a, b) => a + b, 0)) / Math.max(row.length - 1, 1);
        row.forEach((seg) => {
          out += `<rect class="a-fade" style="${d(t + 0.35)}" x="${x}" y="${y + 4}" width="${seg}" height="${6 + i}" fill="${C.amber}"/>`;
          out += `<rect class="a-fade" style="${d(t + 0.35)}" x="${x + seg / 2 - 1.5}" y="${y + 10 + i}" width="3" height="${12 - i}" fill="${C.amber}" fill-opacity=".7"/>`;
          x += seg + gap;
        });
      });
      out += text(x0 + w / 2, 52, "金属连线 · 十多层", { cls: "t s", delay: 5.6, fill: C.amber });
      out += text(x0 + w / 2, 24, "芯片剖面（示意）", { cls: "t s" });
      return out;
    },

    test() {
      let out = "";
      const cx = 112;
      const cy = 110;
      const r = 90;
      const pitch = 18;
      const size = 15;
      const dies = [];
      for (let ix = 0; ix < 10; ix += 1) {
        for (let iy = 0; iy < 10; iy += 1) {
          const x = cx - 90 + ix * pitch + 1.5;
          const y = cy - 90 + iy * pitch + 1.5;
          const inside = [[x, y], [x + size, y], [x, y + size], [x + size, y + size]]
            .every(([px, py]) => Math.hypot(px - cx, py - cy) <= r - 2);
          if (inside) dies.push({ x, y, bad: (ix * 7 + iy * 13) % 8 === 0, ix });
        }
      }
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.panel}" stroke="${C.steel}" stroke-width="1.5"/>`;
      dies.forEach((die) => {
        const t = 0.4 + die.ix * 0.3;
        out += `<rect x="${die.x}" y="${die.y}" width="${size}" height="${size}" rx="1.5" fill="${C.line}"/>`;
        out += `<rect class="a-fade" style="${d(t)}" x="${die.x}" y="${die.y}" width="${size}" height="${size}" rx="1.5" fill="${die.bad ? C.red : C.green}" fill-opacity=".85"/>`;
      });
      out += `<rect class="a-scan" x="${cx - 90}" y="${cy - 90}" width="3" height="180" fill="${C.cyan}"/>`;
      const good = dies.filter((die) => !die.bad).length;
      out += `<rect x="222" y="22" width="10" height="10" rx="2" fill="${C.green}"/>` + text(238, 31, "良品", { cls: "t s", anchor: "start" });
      out += `<rect x="282" y="22" width="10" height="10" rx="2" fill="${C.red}"/>` + text(298, 31, "不良", { cls: "t s", anchor: "start" });
      out += text(282, 62, "探针逐颗通电测试", { cls: "t s", delay: 0.4 });
      out += `<rect class="a-drop" style="${d(3.8)}" x="254" y="84" width="56" height="56" rx="5" fill="${C.green}" fill-opacity=".25" stroke="${C.green}" stroke-width="2"/>`;
      out += text(282, 117, "KGD", { cls: "t b", delay: 4.1, fill: C.green });
      out += text(282, 160, "切割 · 只留良品芯粒", { cls: "t s", delay: 4.1 });
      out += text(282, 190, `示意良率 ${good}/${dies.length}`, { cls: "t b", delay: 4.5 });
      return out;
    },

    hbm() {
      let out = "";
      out += `<rect x="96" y="6" width="168" height="22" rx="11" fill="${C.panel}" stroke="${C.line}"/>`;
      out += text(180, 21, "与 GPU 晶圆并行生产", { cls: "t s" });
      out += `<rect x="100" y="182" width="160" height="14" rx="2" fill="${C.violet}" fill-opacity=".7"/>`;
      out += text(180, 212, "底部：控制芯片", { cls: "t s" });
      for (let k = 0; k < 8; k += 1) {
        out += `<rect class="a-drop" style="${d(0.3 + k * 0.3)}" x="108" y="${166 - k * 15}" width="144" height="11" rx="2" fill="${C.cyan}" fill-opacity=".35" stroke="${C.cyan}"/>`;
      }
      for (let i = 0; i < 7; i += 1) {
        out += `<path class="a-draw" style="--len:140;${d(3 + i * 0.1)}" d="M${120 + i * 20} 190V56" stroke="${C.amber}" stroke-width="2"/>`;
      }
      out += text(94, 108, "DRAM 芯片", { cls: "t b", anchor: "end", fill: C.cyan });
      out += text(94, 124, "一层层堆叠", { cls: "t s", anchor: "end" });
      out += text(266, 108, "TSV 硅通孔", { cls: "t b", anchor: "start", delay: 3, fill: C.amber });
      out += text(266, 124, "垂直打通每层", { cls: "t s", anchor: "start", delay: 3 });
      return out;
    },

    cowos() {
      let out = "";
      const legend = [[C.green, "Chip：GPU 芯粒 ×2 + HBM", 1.6], [C.steel, "on Wafer：硅中介层", 0.8], ["#2fa37e", "on Substrate：ABF 基板", 0]];
      legend.forEach(([color, label, t], i) => {
        out += `<rect class="a-fade" style="${d(t)}" x="16" y="${12 + i * 17}" width="9" height="9" rx="2" fill="${color}"/>`;
        out += text(31, 20.5 + i * 17, label, { cls: "t s", anchor: "start", delay: t });
      });
      out += `<rect class="a-fade" style="${d(0)}" x="40" y="170" width="280" height="18" rx="3" fill="#1f6f54" stroke="#2fa37e"/>`;
      for (let i = 0; i < 15; i += 1) {
        out += `<circle class="a-fade" style="${d(0.3)}" cx="${54 + i * 18}" cy="194" r="4" fill="${C.steel}"/>`;
        out += `<circle class="a-fade" style="${d(1.2)}" cx="${82 + i * 14}" cy="165" r="2.5" fill="${C.steel}"/>`;
      }
      out += `<rect class="a-drop" style="${d(0.8)}" x="70" y="150" width="220" height="11" rx="2" fill="${C.steel}"/>`;
      [128, 182].forEach((x, i) => {
        out += `<g class="a-drop" style="${d(1.6 + i * 0.3)}"><rect x="${x}" y="122" width="50" height="24" rx="2" fill="${C.green}"/>${text(x + 25, 138, "GPU", { cls: "t b", fill: "#0b1020" })}</g>`;
      });
      [78, 240].forEach((x, i) => {
        let stack = "";
        for (let k = 0; k < 5; k += 1) stack += `<rect x="${x}" y="${140 - k * 7}" width="42" height="5" rx="1" fill="${C.cyan}"/>`;
        out += `<g class="a-drop" style="${d(2.4 + i * 0.3)}">${stack}${text(x + 21, 104, "HBM", { cls: "t b", fill: C.cyan })}</g>`;
      });
      out += `<path class="a-fade a-flow" style="${d(3.2)}" d="M99 155.500H153M207 155.500H261" stroke="${C.amber}" stroke-width="2.5"/>`;
      out += text(180, 214, "中介层里的细密走线把 GPU 和 HBM 连起来", { cls: "t s", delay: 3.2, fill: C.amber });
      return out;
    },

    module() {
      let out = "";
      out += `<rect x="50" y="44" width="260" height="134" rx="8" fill="#12382c" stroke="#2fa37e"/>`;
      for (let i = 0; i < 8; i += 1) {
        out += `<rect class="a-fade" style="${d(0.3 + i * 0.05)}" x="${72 + i * 28}" y="54" width="16" height="9" rx="1.5" fill="${C.amber}"/>`;
      }
      out += text(180, 38, "供电模块", { cls: "t s", delay: 0.3, fill: C.amber });
      out += `<path class="a-fade a-flow" style="${d(2.8)}" d="M8 122H180" stroke="${C.cyan}" stroke-width="5"/>`;
      out += `<path class="a-fade a-flow" style="${d(2.8)}" d="M180 122H352" stroke="${C.red}" stroke-width="5"/>`;
      [[80, "GPU", C.green, 0.8], [220, "GPU", C.green, 1.1]].forEach(([x, label, color, t]) => {
        out += `<g class="a-drop" style="${d(t)}"><rect x="${x}" y="92" width="60" height="60" rx="4" fill="${C.panel}" stroke="${color}" stroke-width="1.5"/><rect x="${x + 14}" y="106" width="32" height="32" rx="2" fill="${color}" fill-opacity=".7"/>${text(x + 30, 126, label, { cls: "t b", fill: "#0b1020" })}</g>`;
      });
      out += `<g class="a-drop" style="${d(1.4)}"><rect x="160" y="100" width="40" height="44" rx="4" fill="${C.panel}" stroke="${C.violet}" stroke-width="1.5"/>${text(180, 126, "CPU", { cls: "t b", fill: C.violet })}</g>`;
      [[74, 72], [154, 52], [214, 72]].forEach(([x, w], i) => {
        out += `<rect class="a-drop" style="${d(2.1 + i * 0.15)}" x="${x}" y="86" width="${w}" height="72" rx="9" fill="${C.cyan}" fill-opacity=".22" stroke="${C.cyan}" stroke-width="1.5"/>`;
      });
      out += text(10, 110, "冷液进", { cls: "t s", anchor: "start", delay: 2.8, fill: C.cyan });
      out += text(350, 110, "热液出", { cls: "t s", anchor: "end", delay: 2.8, fill: C.red });
      out += text(180, 172, "液冷冷板压在芯片上", { cls: "t s", delay: 2.1, fill: C.cyan });
      out += text(180, 204, "2 GPU + 1 CPU = 1 组超级芯片", { cls: "t b", delay: 3.2 });
      return out;
    },

    rack() {
      let out = "";
      out += `<rect x="30" y="12" width="108" height="196" rx="6" fill="${C.panel}" stroke="${C.steel}" stroke-width="1.5"/>`;
      for (let i = 0; i < 12; i += 1) {
        const isSwitch = i === 5 || i === 6;
        const color = isSwitch ? C.violet : C.green;
        const y = 20 + i * 15.500;
        const t = 0.2 + (11 - i) * 0.14;
        out += `<g class="a-fade" style="${d(t)}"><rect x="38" y="${y}" width="92" height="11" rx="2" fill="${color}" fill-opacity=".3" stroke="${color}"/>
          <circle class="a-pulse" cx="124" cy="${y + 5.5}" r="1.8" fill="${color}"/></g>`;
      }
      out += text(144, 34, "计算托盘", { cls: "t s", anchor: "start", delay: 1.6, fill: C.green });
      out += text(144, 132, "NVLink 交换机", { cls: "t s", anchor: "start", delay: 1.2, fill: C.violet });
      for (let rIdx = 0; rIdx < 2; rIdx += 1) {
        for (let c = 0; c < 3; c += 1) {
          const x = 246 + c * 34;
          const y = 20 + rIdx * 56;
          const t = 2.4 + (rIdx * 3 + c) * 0.12;
          out += `<path class="a-fade a-flow" style="${d(t + 0.5)}" d="M138 104C190 104 ${x - 30} ${y + 22} ${x} ${y + 22}" fill="none" stroke="${C.cyan}" stroke-width="1.5"/>`;
          out += `<rect class="a-fade" style="${d(t)}" x="${x}" y="${y}" width="24" height="44" rx="3" fill="${C.panel}" stroke="${C.steel}"/>`;
          out += `<rect class="a-fade a-pulse" style="${d(t)}" x="${x + 4}" y="${y + 6}" width="16" height="3" fill="${C.green}"/>`;
        }
      }
      out += text(292, 146, "光纤 + 光模块互连", { cls: "t s", delay: 3, fill: C.cyan });
      out += text(250, 180, "1 柜 = 72 GPU + 36 CPU", { cls: "t b", delay: 3.4 });
      out += text(250, 200, "液冷 · 高功率供电", { cls: "t s", delay: 3.4 });
      return out;
    }
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }
})();
