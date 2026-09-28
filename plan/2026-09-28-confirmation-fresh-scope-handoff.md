# 确认前授权范围复核交接

2026-09-28。Runtime 提交 `aac5f51` 修复了定时任务与即时操作确认时复用 60 秒设备目录缓存的问题。两条确认入口现在强制读取最新授权目录；设备在提案后被撤权时，任务确认返回 `TASK_DEVICE_UNAVAILABLE`，即时草案确认返回 `AUTHORIZED_SCOPE_CHANGED`，均不会进入设备控制。任务确认同时核对设备类型；即时草案在目录读取期间仍保持既有 `EXECUTING` 可见状态，复核失败后回到待确认。

公开 HTTP 回归在默认缓存配置下先复现失败，再随修复通过；Runtime `npm test` 40/40、`npm run typecheck`、`npm run build`、`git diff --check` 通过。测试只使用本地网关夹具，没有操作真实设备。

下一步由用户在客户小程序验收票 02/04/06 的 P2/B6 视觉、任务卡与真实设备记录。票 14 的真实网关最终验收尚未完成；开发端应只补能独立复现的业务缺口，不把本地演示记录当作真实 Task 证据。验收范围和依赖见 `.scratch/region-workbench/spec.md` 及对应票据。

建议技能：继续业务实现用 `$implement`；需要移交新的业务闭环时用 `$handoff`；针对稳定变更做审查时用 `$code-review`。本项目要求交接写入 `plan/`。
