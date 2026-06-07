# 供应链紫苏叶研究平台

这是一个静态网页原型，用来把行业供应链画成图谱，并跟踪重要企业、卡脖子环节和潜在“紫苏叶”玩家。

当前第一版行业是：汽车燃料电池行业。

## 手机预览

网页预览：

https://raw.githack.com/Zxinghao/Fundemeantal-Aanalysis-MVP1/main/index.html

## 核心功能

- 按行业展示供应链图谱。
- 点击公司节点查看供应商地位、卡脖子判断、紫苏叶评分和证据来源。
- 用户可以提交自己的官方数据、财报、公告或分析笔记。
- AI 扫描结果和用户提交都会进入审核台。
- 审核台支持通过、拒绝、补证据。
- 审核结果可以导出为 JSON。
- 通过 GitHub Actions 半自动回写正式数据。

## 数据流

```text
source-watchlist.json
  → web-scan.mjs
  → generated-update-events.json
  → 网页审核台
  → 导出 review-decisions JSON
  → apply-review-decisions.mjs
  → industries.reviewed.json
  → promote-reviewed-data.mjs
  → industries.json
```

## 重要文件

- `index.html`: 网页入口。
- `app.js`: 供应链图谱和审核台主逻辑。
- `review-export.js`: 导出审核结果。
- `data/industries.json`: 正式行业图谱数据。
- `data/source-watchlist.json`: 每日/每周监控源。
- `data/generated-update-events.json`: AI 扫描生成的候选事件。
- `scripts/web-scan.mjs`: 真实网页扫描器雏形。
- `scripts/apply-review-decisions.mjs`: 把审核通过项写入 reviewed 数据。
- `scripts/promote-reviewed-data.mjs`: 人工确认后发布 reviewed 数据。

## GitHub Actions

- `Source Scan`: 定时扫描来源页面，生成候选事件。
- `Apply Review Decisions`: 手动读取审核导出 JSON，生成 `industries.reviewed.json`。
- `Promote Reviewed Data`: 手动确认后，把 reviewed 数据发布为正式 `industries.json`。

## 风险控制

- 扫描器只生成待审核事件，不直接改正式图谱。
- 审核回写只生成 reviewed 候选文件，不直接覆盖正式数据。
- 正式发布必须手动触发，并输入确认词 `PROMOTE`。
- 公司评分、紫苏叶标签、节点和边不会被自动改动。

## 相关文档

- `docs/system-overview.md`
- `docs/data-model.md`
- `docs/information-collection-plan.md`
- `docs/ai-update-event-rules.md`
- `docs/web-scanner.md`
- `docs/review-export.md`
- `docs/apply-review-decisions.md`
- `docs/promote-reviewed-data.md`
