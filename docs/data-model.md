# 供应链紫苏叶研究平台数据模型

## 目标

平台的数据层要支持三件事：

1. 按行业展示完整供应链图。
2. 标注重要企业、核心供应商和紫苏叶候选。
3. 支持 AI 抓取、人工审核、用户提交三类来源进入同一个更新流程。

## 核心对象

### Industry

行业主题，例如汽车燃料电池、AI 光模块、机器人、储能。

关键字段：

- `id`: 行业唯一标识。
- `name`: 行业名称。
- `description`: 行业简介。
- `terminalDemand`: 终端需求描述。
- `researchThesis`: 当前行业链投资研究主线。
- `lastReviewedAt`: 最近一次人工审核时间。

### SupplyChainNode

供应链上的环节或企业节点。

关键字段：

- `id`: 节点唯一标识。
- `industryId`: 所属行业。
- `type`: `terminal`、`chain`、`company`、`zisu`。
- `title`: 节点名称。
- `summary`: 节点简介。
- `layer`: 所在层级，例如终端、系统、部件、材料、设备、资源。
- `tags`: 展示标签。
- `position`: 前端图谱位置。

### Company

企业信息和投资研究判断。

关键字段：

- `id`: 企业唯一标识。
- `name`: 公司名称。
- `ticker`: 股票代码。
- `region`: 国家或地区。
- `businessRole`: 在供应链中的角色。
- `linkedNodeIds`: 关联供应链节点。
- `isKeySupplier`: 是否重要供应商。
- `isBottleneck`: 是否处于卡脖子位置。
- `isZisuCandidate`: 是否紫苏叶候选。
- `signals`: 关键判断。
- `scores`: 紫苏叶评分。
- `recentUpdates`: 最近动态。

### Relationship

节点之间的边，用于画供应链线条。

关键字段：

- `from`: 上一层节点。
- `to`: 下一层节点。
- `relationshipType`: `depends_on`、`supplies`、`integrates`、`competes_with`。
- `confidence`: 关系可信度。
- `sourceIds`: 支撑来源。

### UpdateEvent

所有更新都先进入事件层，不直接改正式图谱。

关键字段：

- `id`: 更新事件唯一标识。
- `sourceType`: `ai_scan`、`user_submission`、`manual_research`。
- `status`: `pending`、`approved`、`rejected`、`needs_more_evidence`。
- `industryId`: 关联行业。
- `companyId`: 关联公司，可为空。
- `nodeId`: 关联节点，可为空。
- `impactType`: `supply_chain_importance`、`bottleneck_judgement`、`financial_update`、`new_player`、`relationship_change`。
- `summary`: 更新摘要。
- `sourceUrl`: 来源链接，可为空。
- `sourceNote`: 文件或人工说明。
- `submittedBy`: 提交者，例如 `user`、`ai`、`researcher`。
- `reviewDecision`: 审核结论。
- `reviewedAt`: 审核时间。

## 用户提交数据流程

1. 用户在网页提交公司或环节、来源、摘要、影响类型。
2. 系统创建 `UpdateEvent`，状态为 `pending`。
3. AI 可以补充结构化字段，例如关联行业、关联公司、可能影响的供应链节点。
4. 人工审核：
   - 证据充分：标记为 `approved`，更新正式数据。
   - 证据不足：标记为 `needs_more_evidence`。
   - 不相关或不可靠：标记为 `rejected`。
5. 所有审核记录保留，方便回溯为什么某家公司被标记为紫苏叶候选。

## 紫苏叶评分建议

建议先用 0-100 分的解释型评分，不做黑箱模型。

评分维度：

- `supplyChainImportance`: 供应链重要性。
- `scarcity`: 稀缺性。
- `pricingPower`: 定价权。
- `switchingCost`: 客户切换成本。
- `validationBarrier`: 验证壁垒。
- `marketUnderappreciation`: 市场低估程度。

紫苏叶候选的默认规则：

- 供应链重要性 >= 75。
- 稀缺性 >= 70。
- 验证壁垒 >= 70。
- 至少有一条可信来源支持其关键供应商地位。
- 不直接等同于热门终端龙头，优先考虑上游材料、部件、设备或系统瓶颈。

## 下一步实现顺序

1. 将 `app.js` 中写死的数据迁移到独立数据文件。
2. 增加审核队列页面或审核视图。
3. 增加来源记录和可信度字段。
4. 再接入每日/每周自动抓取逻辑。
5. 最后统一做前端视觉和移动端排版设计。
