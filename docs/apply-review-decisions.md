# 回写审核结果

## 作用

`scripts/apply-review-decisions.mjs` 读取网页导出的审核 JSON，只处理 `approved` 项，并生成一个新的正式数据候选文件：

`data/industries.reviewed.json`

第一版不会直接覆盖 `data/industries.json`，避免误改正式图谱。

## 输入

网页审核台导出的文件，例如：

```text
review-decisions-fuel-cell-2026-06-07.json
```

## 运行方式

```bash
node scripts/apply-review-decisions.mjs review-decisions-fuel-cell-2026-06-07.json
```

## 做了什么

对每条 `approved` 审核项：

1. 在对应行业的 `updateEvents` 里追加一条 `manual_research` 事件。
2. 如果能匹配公司名称，就把摘要追加到该公司的 `recentUpdates`。
3. 更新行业的 `lastReviewedAt`。
4. 输出到 `data/industries.reviewed.json`。

## 不做什么

- 不自动改公司评分。
- 不自动改紫苏叶标签。
- 不自动改供应链节点和边。
- 不直接覆盖正式 `data/industries.json`。

这些动作需要更严格的审核规则，后续再做。
