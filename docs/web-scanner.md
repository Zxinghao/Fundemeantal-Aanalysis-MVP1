# 真实网页扫描器雏形

## 作用

`scripts/web-scan.mjs` 是真实扫描器的第一版。它会访问 `source-watchlist.json` 里的来源 URL，提取网页标题和正文文本，计算正文指纹，并和 `data/source-cache.json` 里的历史指纹比较。

只有当页面内容发生变化时，它才会生成候选 `UpdateEvent`。

## 数据链路

`source-watchlist.json` → `web-scan.mjs` → `source-cache.json` → `generated-update-events.json` → 网页审核台

## 输出

- `data/source-cache.json`: 保存每个来源最近一次扫描的标题、hash、检查时间和错误。
- `data/generated-update-events.json`: 保存本轮扫描发现的变化事件。

## 运行方式

```bash
node scripts/web-scan.mjs
```

也可以指定扫描日期：

```bash
node scripts/web-scan.mjs 2026-06-07
```

## 审核原则

扫描器只能证明“网页内容变了”，不能证明“投资判断变了”。  
因此生成的事件仍然必须进入人工审核台，由人确认是否影响供应链节点、公司评分或紫苏叶判断。

## 后续升级

1. 加入正文摘要模型，把变化内容压缩成更像研究笔记的 `summary`。
2. 增加网页差异对比，只展示新增段落。
3. 增加去重逻辑，避免同一个页面频繁生成重复事件。
4. 增加财报 PDF、公告 PDF 和交易所公告抓取。
5. 增加定时任务，每天或每周自动运行。
