# 模拟扫描器

## 作用

`scripts/mock-scan.mjs` 用来模拟“每日/每周信息扫描”这一步。  
它不会抓取真实网页正文，而是读取 `data/source-watchlist.json`，按监控源生成标准化候选 `UpdateEvent`。

这个脚本的目标是先打通数据链路：

`source-watchlist.json` → `generated-update-events.json` → 网页审核台

## 输入

- `data/source-watchlist.json`

## 输出

- `data/generated-update-events.json`

## 运行方式

```bash
node scripts/mock-scan.mjs
```

也可以指定扫描日期：

```bash
node scripts/mock-scan.mjs 2026-06-07
```

## 第一版限制

- 不访问真实网页。
- 不判断页面是否真的更新。
- 不提取财报或新闻正文。
- 只根据监控源、关键词、公司 ID 和节点 ID 生成候选事件。

## 后续升级

1. 读取真实网页标题和正文。
2. 只在内容发生变化时生成事件。
3. 增加摘要模型，把正文压缩成 `summary`。
4. 增加去重逻辑，避免重复生成同一事件。
5. 把审核通过的事件半自动写回 `data/industries.json`。
