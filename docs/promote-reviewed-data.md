# 发布已审核数据

## 作用

`scripts/promote-reviewed-data.mjs` 是正式发布前的安全闸门。  
它会把 `data/industries.reviewed.json` 提升为正式的 `data/industries.json`。

## 为什么需要这一步

前面的回写脚本只生成候选文件，不直接覆盖正式数据。  
这一步要求人工确认后才发布，避免审核结果或脚本误判直接进入正式图谱。

## 本地运行

```bash
node scripts/promote-reviewed-data.mjs PROMOTE
```

脚本会：

1. 检查 `data/industries.reviewed.json` 是否是有效行业数组。
2. 把当前 `data/industries.json` 备份到 `data/industries.previous.json`。
3. 用 reviewed 文件替换正式 `data/industries.json`。

## GitHub Actions 运行

在 GitHub Actions 页面手动运行 `Promote Reviewed Data` 工作流，并输入：

```text
PROMOTE
```

工作流会提交：

- `data/industries.json`
- `data/industries.previous.json`

## 风险控制

- 必须手动触发。
- 必须输入确认词。
- 会保留上一版正式数据。
- 只提升已生成的 reviewed 文件，不重新解释审核内容。
