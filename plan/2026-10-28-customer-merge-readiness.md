# 合并到客户仓库的准备状态

2026-10-28。本机已收敛为单一分支 `新世纪办公室`（`2a60878`）。用户问能否准备好合并到客户仓库。

## 已就绪的部分

干净交付树已生成并核对：

```
node tools/deliver.mjs
-> /var/folders/.../deliver-2a60878-...   （单提交 f211573，496 个文件）
-> 核对通过：无计划/研究/票据/agent 上下文/原型/探针/内部 README
```

`git ls-tree -r --name-only HEAD | grep -cE '^(plan|docs|\.scratch|tools)/|AGENTS\.md$|^CONTEXT\.md$'` = **0**。
关键内容在包内：`apis/agent/agent-read-cache.mjs`、`static/iot-assistant-icon.png`、`test/agent-read-cache.test.mjs`、`deploy/branding/iot-assistant-icon.svg`。

排除规则来自 `.gitattributes` 的 `export-ignore`（`/plan/`、`/docs/`、`/.scratch/`、`/tools/`、`AGENTS.md`、`/CONTEXT.md`、`/README.md`、原型页与诊断探针），`tools/deliver.mjs` 再用同一套禁止路径二次核对。

## 未完成的部分：不能在此环境完成

`origin` = `http://192.168.101.194:55080/microbrain/mp.git`（客户内网 GitLab）。本机当前不在该网络：

```
git ls-remote --heads origin   # 20 秒无响应，超时退出
```

所以 push/merge 到客户仓库必须在内网环境执行。到位后按交付树打印的命令操作：

```
git fetch <交付树目录> HEAD
git merge --allow-unrelated-histories FETCH_HEAD     # 或按需只取该提交
git push origin <客户分支>
```

## 推送前需要确认的两件事（本地无法判断）

1. 客户仓库里 `新世纪办公室` 的实际 HEAD。本地这条分支领先本地 `github/main` 187 个提交，但与客户内网仓库的共同祖先未知；合并方式（fast-forward / merge commit / 只挑单个提交）取决于该 HEAD。
2. 客户仓库里是否存在只在那边改动过的文件（例如网关地址、AppID 相关配置）。交付树是整树覆盖，直接合并会以本机版本为准。

## 交付物备份

`~/backups/mp-allrefs-20261028.bundle`（33M，含收敛前的全部 36 个分支，`git bundle verify` = complete history）。
