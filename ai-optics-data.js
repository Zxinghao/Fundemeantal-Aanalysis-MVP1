(function patchAiOpticsIndustry() {
  const aiOpticsIndustry = {
    id: "ai-optics",
    name: "AI Optical Module Industry",
    description: "Trace AI data-center demand into high-speed switching, optical modules, DSPs, silicon photonics, lasers, external light sources, packaging, and module manufacturing.",
    terminalDemand: "High-speed data-center interconnect demand driven by AI training and inference clusters.",
    researchThesis: "Start from AI cluster scale-out demand, then trace upstream to scarce optical interconnect nodes: high-speed switches, pluggable optical modules, DSPs, silicon photonics, EML/laser devices, CPO external light sources, packaging, and high-yield module manufacturing.",
    languagePolicy: {
      primaryLanguage: "en",
      sourcePreference: "Prioritize English official sources, investor relations materials, product pages, filings, standards bodies, and company technical announcements."
    },
    sources: [
      { id: "nvidia-spectrum-x-photonics", title: "NVIDIA Spectrum-X Photonics announcement", type: "company_official", url: "https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Spectrum-X-Photonics-Co-Packaged-Optics-Networking-Switches-to-Scale-AI-Factories-to-Millions-of-GPUs/", note: "Official NVIDIA source for co-packaged optics networking switches for AI factories." },
      { id: "broadcom-cpo", title: "Broadcom co-packaged optics product overview", type: "company_official", url: "https://www.broadcom.com/products/fiber-optic-modules-components/co-packaged-optics", note: "Official Broadcom source describing CPO, DSP, switch ASIC, packaging and test, and pluggable laser source capabilities." },
      { id: "broadcom-bailly", title: "Broadcom Bailly 51.2-Tbps CPO Ethernet switch platform", type: "company_official", url: "https://investors.broadcom.com/news-releases/news-release-details/broadcom-delivers-industrys-first-512-tbps-co-packaged-optics", note: "Official Broadcom investor release on CPO Ethernet switching for scalable AI systems." },
      { id: "marvell-pam4-dsp", title: "Marvell PAM4 optical DSPs", type: "company_official", url: "https://www.marvell.com/products/pam-dsp.html", note: "Official Marvell source for PAM4 DSPs used in AI data-center optical interconnects." },
      { id: "marvell-optical-dsp", title: "Marvell optical DSPs for AI infrastructure", type: "company_official", url: "https://www.marvell.com/solutions/data-center/optical-dsp.html", note: "Official Marvell source positioning optical DSPs across AI network tiers." },
      { id: "coherent-datacenter", title: "Coherent data-center communications", type: "company_official", url: "https://www.coherent.com/datacenter-communications", note: "Official Coherent source for data-center optical communications products." },
      { id: "coherent-200g-eml", title: "Coherent 200G InP EML announcement", type: "company_official", url: "https://www.coherent.com/news/press-releases/coherent-introduces-200g-indium-phosphile-electro-absorption-modulated-lasers", note: "Official Coherent source for 200G InP EML devices used in 800G and 1.6T transceivers." },
      { id: "lumentum-eml", title: "Lumentum data-center EML products", type: "company_official", url: "https://www.lumentum.com/en/products/data-center/modulated-lasers/emls", note: "Official Lumentum source for modulated lasers used in data-center optical modules." },
      { id: "fabrinet-optical-components", title: "Fabrinet optical component manufacturing services", type: "company_official", url: "https://fabrinet.com/services/optical-components", note: "Official Fabrinet source for optical component manufacturing, packaging, and test capabilities." },
      { id: "eoptolink-800g", title: "Eoptolink 800G optical module products", type: "company_official", url: "https://eoptolink.com/product-solutions/800g", note: "Official Eoptolink source for 800G optical transceiver products." },
      { id: "innolight-home", title: "Innolight optical transceiver products", type: "company_official", url: "https://www.innolight.com/", note: "Official Innolight source for optical transceiver product positioning." }
    ],
    nodes: [
      node("ai-demand", "terminal", "AI Compute Demand", "Training / inference / hyperscale AI data centers", "End market", ["AI factories", "cluster scale-out"], 40, 300),
      node("gpu-cluster", "chain", "GPU Clusters", "Large accelerator clusters create east-west bandwidth pressure", "System", ["scale-out", "high bandwidth"], 270, 210),
      node("switching", "chain", "AI Networking Switches", "Ethernet / InfiniBand switching determines cluster fabric bandwidth", "System", ["switch ASIC", "fabric"], 500, 210),
      node("optical-modules", "chain", "Pluggable Optical Modules", "800G / 1.6T transceivers connect servers, switches, and racks", "Module", ["800G", "1.6T"], 730, 210),
      node("linear-optics", "chain", "Linear-drive Optics", "Lower-power module architecture that can reduce DSP content in short-reach links", "Module architecture", ["power reduction", "short reach"], 730, 390),
      node("dsp", "chain", "PAM4 Optical DSP", "Signal processing silicon for high-speed optical modules", "Semiconductor", ["scarce IP", "validation barrier"], 970, 90),
      node("silicon-photonics", "chain", "Silicon Photonics Engine", "Integrates optical functions close to switch silicon for CPO architectures", "Photonics semiconductor", ["CPO", "integration"], 970, 230),
      node("laser", "chain", "EML / Laser Devices", "InP EML and laser devices are critical optical-source components", "Optical device", ["InP", "laser bottleneck"], 970, 370),
      node("external-light-source", "chain", "External Light Source", "CPO architecture can move lasers outside the switch package", "CPO subsystem", ["hidden bottleneck", "CPO"], 970, 520),
      node("packaging-test", "chain", "Optical Packaging & Test", "High-yield assembly, alignment, burn-in, and test constrain scale", "Manufacturing", ["yield", "qualification"], 1210, 370),
      node("fiber-connectors", "chain", "Fiber Attach / Connectors", "Dense optical I/O requires precise fiber handling and connector reliability", "Manufacturing", ["density", "reliability"], 1210, 520),
      node("nvidia", "company", "NVIDIA", "AI networking systems and photonics roadmap", "Company", ["AI fabric", "CPO sponsor"], 500, 430),
      node("broadcom", "zisu", "Broadcom", "Switch ASIC, CPO platform, DSP, and pluggable laser source", "Company", ["CPO platform", "hidden bottleneck"], 1210, 70),
      node("marvell", "company", "Marvell", "PAM4 optical DSP silicon for AI data-center interconnects", "Company", ["DSP leader"], 1210, 210),
      node("coherent", "zisu", "Coherent", "Datacenter optics, InP EML, lasers, and optical components", "Company", ["laser bottleneck", "optics supplier"], 1450, 240),
      node("lumentum", "zisu", "Lumentum", "EML and modulated lasers for datacenter modules", "Company", ["laser supplier", "hidden bottleneck"], 1450, 370),
      node("fabrinet", "zisu", "Fabrinet", "Optical manufacturing, packaging, and test services", "Company", ["manufacturing bottleneck", "yield"], 1450, 510),
      node("innolight", "company", "Innolight", "High-speed optical transceiver module supplier", "Company", ["800G modules"], 970, 690),
      node("eoptolink", "company", "Eoptolink", "800G optical transceiver module supplier", "Company", ["800G modules"], 730, 690)
    ],
    relationships: [
      rel("ai-demand", "gpu-cluster", "drives", ["nvidia-spectrum-x-photonics"]),
      rel("gpu-cluster", "switching", "depends_on", ["nvidia-spectrum-x-photonics"]),
      rel("switching", "optical-modules", "depends_on", ["nvidia-spectrum-x-photonics", "broadcom-bailly"]),
      rel("optical-modules", "dsp", "depends_on", ["marvell-pam4-dsp", "marvell-optical-dsp"]),
      rel("optical-modules", "silicon-photonics", "evolves_to", ["nvidia-spectrum-x-photonics", "broadcom-cpo"]),
      rel("optical-modules", "laser", "depends_on", ["coherent-200g-eml", "lumentum-eml"]),
      rel("optical-modules", "linear-optics", "alternative_architecture", ["marvell-optical-dsp"]),
      rel("silicon-photonics", "external-light-source", "depends_on", ["broadcom-cpo"]),
      rel("optical-modules", "packaging-test", "depends_on", ["fabrinet-optical-components"]),
      rel("external-light-source", "fiber-connectors", "depends_on", ["broadcom-cpo"]),
      rel("switching", "nvidia", "system_provider", ["nvidia-spectrum-x-photonics"]),
      rel("switching", "broadcom", "supplies_platform", ["broadcom-cpo", "broadcom-bailly"]),
      rel("dsp", "marvell", "supplies", ["marvell-pam4-dsp", "marvell-optical-dsp"]),
      rel("silicon-photonics", "broadcom", "supplies_platform", ["broadcom-cpo", "broadcom-bailly"]),
      rel("laser", "coherent", "supplies", ["coherent-datacenter", "coherent-200g-eml"]),
      rel("laser", "lumentum", "supplies", ["lumentum-eml"]),
      rel("packaging-test", "fabrinet", "manufactures", ["fabrinet-optical-components"]),
      rel("optical-modules", "innolight", "supplies_modules", ["innolight-home"]),
      rel("optical-modules", "eoptolink", "supplies_modules", ["eoptolink-800g"])
    ],
    companies: [
      company("nvidia", "NVIDIA", "NASDAQ: NVDA", "United States", "AI networking system provider and major demand shaper for CPO and silicon-photonics architectures", ["nvidia", "switching", "gpu-cluster"], ["nvidia-spectrum-x-photonics"], true, false, false, [95, 72, 90, 88, 86, 35]),
      company("broadcom", "Broadcom", "NASDAQ: AVGO", "United States", "Switch ASIC, CPO platform, DSP, optical engine, and pluggable laser source supplier", ["broadcom", "switching", "silicon-photonics", "external-light-source"], ["broadcom-cpo", "broadcom-bailly"], true, true, true, [96, 90, 86, 88, 92, 60]),
      company("marvell", "Marvell", "NASDAQ: MRVL", "United States", "PAM4 optical DSP silicon supplier for high-speed optical modules", ["marvell", "dsp", "optical-modules"], ["marvell-pam4-dsp", "marvell-optical-dsp"], true, true, false, [90, 84, 78, 82, 88, 58]),
      company("coherent", "Coherent", "NASDAQ: COHR", "United States", "Datacenter optics, InP EML, lasers, and optical component supplier", ["coherent", "laser", "optical-modules"], ["coherent-datacenter", "coherent-200g-eml"], true, true, true, [88, 84, 74, 81, 87, 70]),
      company("lumentum", "Lumentum", "NASDAQ: LITE", "United States", "EML and modulated laser supplier for data-center optical modules", ["lumentum", "laser"], ["lumentum-eml"], true, true, true, [84, 80, 70, 78, 84, 72]),
      company("fabrinet", "Fabrinet", "NYSE: FN", "Thailand / Cayman Islands", "Optical component manufacturing, packaging, alignment, and test services provider", ["fabrinet", "packaging-test", "fiber-connectors"], ["fabrinet-optical-components"], true, true, true, [86, 78, 72, 82, 85, 76]),
      company("innolight", "Innolight", "Private / China", "China", "High-speed optical transceiver module supplier", ["innolight", "optical-modules"], ["innolight-home"], true, false, false, [80, 64, 60, 66, 72, 58]),
      company("eoptolink", "Eoptolink", "SHE: 300502", "China", "800G optical transceiver module supplier", ["eoptolink", "optical-modules"], ["eoptolink-800g"], true, false, false, [78, 62, 58, 65, 70, 62])
    ],
    updateEvents: [
      {
        id: "ai-optics-broadcom-cpo-review",
        sourceType: "ai_scan",
        status: "pending",
        industryId: "ai-optics",
        companyId: "broadcom",
        nodeId: "external-light-source",
        impactType: "bottleneck_judgement",
        summary: "Verify Broadcom CPO platform adoption and whether pluggable laser source demand becomes a separate bottleneck node.",
        sourceUrl: "https://www.broadcom.com/products/fiber-optic-modules-components/co-packaged-optics",
        sourceNote: "Official Broadcom product material",
        sourceIds: ["broadcom-cpo"],
        submittedBy: "ai",
        reviewDecision: null,
        reviewedAt: null
      }
    ]
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.endsWith("data/industries.json")) return response;

    const data = await response.clone().json();
    const patchedData = Array.isArray(data)
      ? data.map((industry) => industry.id === "ai-optics" ? aiOpticsIndustry : industry)
      : data;

    if (Array.isArray(data) && !patchedData.some((industry) => industry.id === "ai-optics")) {
      patchedData.push(aiOpticsIndustry);
    }

    return new Response(JSON.stringify(patchedData), {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": "application/json" }
    });
  };

  function node(id, type, title, summary, layer, tags, x, y) {
    return { id, type, title, summary, layer, tags, position: { x, y } };
  }

  function rel(from, to, relationshipType, sourceIds) {
    return { from, to, relationshipType, confidence: "high", sourceIds };
  }

  function company(id, name, ticker, region, businessRole, linkedNodeIds, sourceIds, isKeySupplier, isBottleneck, isZisuCandidate, scoreValues) {
    return {
      id,
      name,
      ticker,
      region,
      businessRole,
      linkedNodeIds,
      sourceIds,
      isKeySupplier,
      isBottleneck,
      isZisuCandidate,
      signals: {
        importantSupplier: isKeySupplier ? "Yes. This company is linked to a critical AI optical interconnect node." : "No. It is strategically relevant but not classified as a key upstream supplier.",
        bottleneckPosition: isBottleneck ? "High. Qualification, yield, integration, or scarce technical capability creates a potential chokepoint." : "Medium. Important but less bottleneck-like than device, DSP, CPO, or packaging nodes.",
        playerConcentration: isBottleneck ? "Medium-high to high." : "Medium.",
        recentCatalyst: "Track official product announcements, customer adoption, capacity, and AI data-center optical interconnect demand."
      },
      scores: {
        supplyChainImportance: scoreValues[0],
        scarcity: scoreValues[1],
        pricingPower: scoreValues[2],
        switchingCost: scoreValues[3],
        validationBarrier: scoreValues[4],
        marketUnderappreciation: scoreValues[5]
      },
      recentUpdates: [
        `${name} is mapped to the AI optical supply chain using English official product or investor sources.`,
        "Refresh this record weekly with official announcements, financial reports, and customer qualification evidence."
      ]
    };
  }
})();
