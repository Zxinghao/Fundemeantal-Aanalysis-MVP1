# 审核结果导出

## 作用

当前网页是静态网页，审核按钮的结果会先保存在浏览器本地 `localStorage`。  
“导出审核结果”按钮会把当前行业中已经审核过的事件导出为 JSON 文件。

## 导出内容

导出的 JSON 包含：

- `exportedAt`: 导出时间。
- `industryId`: 当前行业 ID。
- `industryName`: 当前行业名称。
- `reviewedItems`: 已审核事件列表。

每条 `reviewedItems` 会包含：

- `id`: 事件 ID。
- `company`: 公司或节点名称。
- `impact`: 影响类型。
- `origin`: 来源类型，例如 AI 扫描、图谱候选、用户提交。
- `source`: 来源链接或说明。
- `sourceIds`: 绑定来源 ID。
- `summary`: 事件摘要。
- `reviewStatus`: 审核结论。

## 下一步用途

这份文件可以作为“回写正式数据”的输入。  
后续可以做一个脚本读取导出的审核结果，只处理 `approved` 事件，并把它们半自动写回 `data/industries.json`。
