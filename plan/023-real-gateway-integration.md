# 023 · Agent 接入真实物联网网关（读路径闭环）

日期：2026-09-16 ｜ 仓库：iot-agent-runtime（分支 codex/multi-candidate-lighting-draft）+ mp 记录

## 本轮闭环

Agent 后端直连生产网关 `https://ncim.577119.com`，以 EgoLite 内真实登录用户（26楼运营办公区/XSJ）完成：目录发现 → 状态读取 → 模型问答 → 真实状态感知草案。未下发任何控制；草案已取消、会话已清理。

## 交付

- runtime `9673781`：生产 scoped 记录 `installAddress` 为 null 导致目录崩溃的修复（办公室 elementName 兜底 + 回归测试），全量测试通过。
- 3201 实例：`IOT_BASE_URL=https://ncim.577119.com DATABASE_PATH=var/real-runtime.sqlite`，dist 含 9673781 + 7036da3（并行会话的控制超时判定）。3200 iotfake 实例未动。
- 证据：`docs/research/2026-09-16-real-gateway-agent-integration.md`（含鉴权口径差异——本会话 micro-api 要求 bearer 前缀，与 09-15 记录相左，需入测试）。

## 未完（下一轮候选）

1. 经授权的真实控制往返（一路照明 开→关→恢复），实测 25s 超时判定与照明受理语义。
2. 前端登录集成：`apis/agent/index.js` 的 local-development/LOCAL 换成主工程同源登录态注入；agent-miniapp 指向 3201 验证端到端。
3. 鉴权头形式差异补进 adapter 透传测试。

## 踩坑

- runtime 仓库无「新世纪办公室」分支；runtime 主线即当前 codex 分支（历史含全部 018-022 提交），提交前先看 `git branch -v`。
- 共享工作区有并行会话时，重启端口进程用 `lsof -tiTCP:<port> -sTCP:LISTEN` 精确杀；`pkill -f` 匹配不到环境变量启动的进程，会误留旧实例导致 EADDRINUSE 后仍由旧代码服务。
