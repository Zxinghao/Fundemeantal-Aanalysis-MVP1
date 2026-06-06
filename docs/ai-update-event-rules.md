# AI 生成 UpdateEvent 规则

## 目标

AI 扫描行业信息后，不直接修改正式供应链图谱，只生成候选 `UpdateEvent`。  
候选事件进入审核台，由人工判断是否通过、拒绝，或需要补充证据。

## 输入

AI 每次扫描至少需要读取三类输入：

- `data/source-watchlist.json`: 每日/每周需要关注的来源。
- `data/industries.json`: 当前行业图谱、公司、节点、已有事件。
- 外部来源文本: 公司新闻、财报、投资者材料、政府文件或行业报道。

## 输出格式

AI 必须输出 JSON 数组，每个元素都是一个候选 `UpdateEvent`。

```json
[
  {
    "id": "ai-fuel-cell-2026-06-06-jm-001",
    "sourceType": "ai_scan",
    "status": "pending",
    "industryId": "fuel-cell",
    "companyId": "jm",
    "nodeId": "catalyst",
    "impactType": "technology_change",
    "summary": "Johnson Matthey 的燃料电池催化剂或 CCM 信息出现更新，需要核验是否影响其卡脖子判断。",
    "sourceUrl": "https://example.com/source",
    "sourceNote": "AI 从公司官网或投资者材料中提取的候选变化，尚未人工确认。",
    "sourceIds": ["jm-news"],
    "submittedBy": "ai",
    "reviewDecision": null,
    "reviewedAt": null,
    "confidence": "medium",
    "evidenceLevel": "A",
    "proposedActions": [
      {
        "target": "company.signals.recentCatalyst",
        "action": "append",
        "reason": "新增动态可能影响近期催化剂描述。"
      }
    ]
  }
]
```

## 字段规则

- `id`: 使用 `ai-{industryId}-{YYYY-MM-DD}-{companyId或nodeId}-{序号}`。
- `sourceType`: 固定为 `ai_scan`。
- `status`: 固定为 `pending`。
- `industryId`: 必须能匹配现有行业 ID。
- `companyId`: 能明确对应公司时填写；不能明确时为 `null`。
- `nodeId`: 能明确对应供应链环节时填写；不能明确时为 `null`。
- `impactType`: 必须从允许值中选择。
- `summary`: 一句话说明“发生了什么”和“为什么需要审核”。
- `sourceUrl`: 原始来源链接，不能写二手跳转链接。
- `sourceNote`: 简短说明来源性质和 AI 的判断限制。
- `sourceIds`: 优先使用 `source-watchlist.json` 或 `industries.json` 里已有的来源 ID。
- `submittedBy`: 固定为 `ai`。
- `reviewDecision`: 固定为 `null`。
- `reviewedAt`: 固定为 `null`。
- `confidence`: `low`、`medium`、`high`，表示 AI 对事件归类的信心，不等于真实性。
- `evidenceLevel`: `A`、`B`、`C`，表示来源等级。
- `proposedActions`: AI 建议审核通过后可能修改哪些字段，但不自动执行。

## impactType 允许值

- `supply_chain_importance`: 影响公司或环节重要性。
- `bottleneck_judgement`: 影响卡脖子判断。
- `financial_update`: 财报、订单、收入、利润率、现金流。
- `new_player`: 新增玩家。
- `relationship_change`: 新客户、新供应商、合作关系变化。
- `capacity_change`: 产能扩张、投产、停产、延期。
- `technology_change`: 技术路线、效率、成本、专利、认证变化。
- `policy_change`: 政策、补贴、监管变化。

## 事件生成标准

只有满足至少一项条件，才生成 `UpdateEvent`：

- 出现新的订单、客户、合作伙伴或供应关系。
- 公司披露了产能、工厂、产品线、认证或技术进展。
- 财报中出现与该行业相关的收入、利润率、资本开支或指引变化。
- 政策、补贴、监管或政府资金影响行业需求。
- 新公司进入关键节点，或原有公司退出/收缩。
- 信息可能改变重要供应商、卡脖子位置或紫苏叶评分。

## 不生成事件的情况

- 只有营销口号，没有新事实。
- 只重复已有信息，没有变化。
- 来源无法追溯。
- 只涉及股价波动，但找不到业务原因。
- 事件与当前行业图谱无明确关系。

## 审核建议

AI 生成事件时，不能给出“已确认”的口吻。推荐使用：

- “需要核验是否影响……”
- “可能提示……”
- “建议关注……”
- “若属实，可能需要更新……”

避免使用：

- “已经证明……”
- “确定是卡脖子……”
- “必须上调评分……”
- “公司已成为唯一供应商……”

## 第一版执行流程

1. 根据 `source-watchlist.json` 选择每日或每周来源。
2. AI 阅读来源页面或用户提供的材料。
3. AI 输出候选 `UpdateEvent` JSON。
4. 候选事件进入网页审核台。
5. 人工审核通过后，再手动或半自动更新 `data/industries.json`。
