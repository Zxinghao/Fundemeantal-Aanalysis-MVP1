# 系统总览

## 产品目标

这个平台的目标不是简单罗列公司，而是沿着“终端需求 → 系统 → 部件 → 材料 → 企业”的路径，找出供应链中的关键瓶颈和潜在紫苏叶玩家。

第一版选择汽车燃料电池行业，是因为它能清楚展示方法论：

- 终端需求：零排放商用车、重卡、客车、物流车。
- 系统层：整车集成、燃料电池系统、电堆。
- 部件层：MEA、储氢系统、BOP 辅助系统。
- 材料层：铂基催化剂、GDL、碳纤维复材。
- 企业层：Johnson Matthey、FORVIA、Garrett Motion 等。

## 前端模块

### 供应链图谱

文件：

- `index.html`
- `styles.css`
- `app.js`

功能：

- 展示行业图谱。
- 绘制节点和供应链连线。
- 点击公司节点打开详情弹窗。
- 展示证据来源和紫苏叶评分。

### 审核台

文件：

- `app.js`
- `review-export.js`
- `review-export.css`

功能：

- 合并三类事件：AI 扫描、图谱候选、用户提交。
- 支持审核状态：待审核、已通过、已拒绝、需补证据。
- 审核结果先保存在浏览器本地。
- 可导出审核 JSON。

## 数据模块

### 正式数据

`data/industries.json`

包括：

- 行业描述。
- 供应链节点。
- 节点关系。
- 公司信息。
- 评分和信号。
- 正式 updateEvents。

### 监控源

`data/source-watchlist.json`

包括：

- 每日监控源。
- 每周监控源。
- 关联公司 ID。
- 关联供应链节点 ID。
- 关键词。

### 扫描结果

`data/generated-update-events.json`

这是扫描器写出的候选事件文件。网页会优先读取它，如果没有，再读取 sample 文件。

## 自动化模块

### 1. Source Scan

Workflow:

`.github/workflows/source-scan.yml`

作用：

- 定时运行 `scripts/web-scan.mjs`。
- 检测来源页面内容是否变化。
- 写入 `source-cache.json` 和 `generated-update-events.json`。

### 2. Apply Review Decisions

Workflow:

`.github/workflows/apply-review.yml`

作用：

- 读取网页导出的审核 JSON。
- 只处理 `approved` 项。
- 生成 `data/industries.reviewed.json`。

### 3. Promote Reviewed Data

Workflow:

`.github/workflows/promote-reviewed.yml`

作用：

- 人工确认后，把 `industries.reviewed.json` 发布为正式 `industries.json`。
- 保存上一版为 `industries.previous.json`。

## 完整使用流程

1. 打开网页预览。
2. 查看供应链图谱和公司弹窗。
3. 在审核台处理 AI 扫描事件。
4. 点击“导出审核结果”。
5. 将导出的 JSON 放入仓库。
6. 运行 `Apply Review Decisions`。
7. 检查生成的 `industries.reviewed.json`。
8. 确认无误后运行 `Promote Reviewed Data`。
9. 正式网页读取新的 `industries.json`。

## 当前限制

- 仍是静态网页，没有数据库和登录系统。
- 审核结果保存在浏览器本地，需要手动导出。
- 扫描器只能判断页面内容是否变化，不能自动判断投资含义。
- 回写脚本不会自动改评分、节点或供应链边。
- 前端排版还没有进入最终设计阶段。

## 下一步建议

1. 增加移动端布局优化。
2. 增加审核 JSON 上传入口。
3. 增加 reviewed 数据对比页面。
4. 增加真实网页差异摘要。
5. 扩展第二个行业的数据源和供应链图谱。
