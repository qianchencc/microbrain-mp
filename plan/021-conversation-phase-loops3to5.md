# 021 会话相位状态机 · 闭环 3-5：相位持久化、上下文收敛、前端相位权威

- 日期：2026-09-16
- 票据：.scratch/conversation-phase-machine/issues/05-07（均 done）
- 提交：runtime 8e130a4 / 689c1bb（已部署 3200）；mp 0877b30

## 闭环 3（票 05）相位持久化与启动自愈

- `conversations.phase` 列（idle|running|awaiting_confirmation|executing）为唯一权威；`syncPhase` 挂接全部过渡点：消息开始/运行收尾、确认获准执行、执行收尾、取消、重新核验、清除会话。
- 启动自愈：`running`/NULL → idle；崩溃残留 EXECUTING 草案 → EXPIRED（无法证明执行结果，走重新核验按当前设备状态重建，不冒险重发指令）。
- 测试：模拟崩溃现场（直改库 running+EXECUTING）→ 重启实例自愈 idle、草案 EXPIRED、消息不再被卡死。

## 闭环 4（票 06）模型上下文收敛

- `ActionDraftContext` 由 drafts 数组改为 `{ draft: 前沿待确认草案|null, lastExecution: {draftId,status,summary}|null }`；`loadActionDraftContext` 取最新 PENDING 与最近一次执行终态。
- pi-runner 修订守卫改读单对象（draftId 修订仅认前沿草案）；提示词注入形状自动收敛。既有"已确认草案执行结果进入上下文"测试改为断言新契约（明细不再进上下文，只留摘要——细节在会话历史里）。

## 闭环 5（票 07）前端相位权威与补丁清理

- index.vue 新增 `phase` ref，restore 直接采用服务端权威相位。
- 删除过渡补丁：`staleRunSince` 僵死 running 本地解锁整体移除（05 的持久相位 + 启动自愈使其失效）；stopRun 回归纯本地中止。selectDraft 的过期预检/本地 EXPIRED 翻转保留（与服端惰性过期语义一致）。
- 注意：并行会话当时正在该模块在途修改（删除 card-press 等，测试 34→26 属其在途工作），本次仅提交了属于本票的 index.vue 差异。

## 验证

- runtime 全量 67/67；前端在途状态 26/26 + 微信构建通过；真实服务器 smoke：提案→`awaiting_confirmation`、取消→`idle`，自愈经崩溃模拟测试证实。3200 已部署。

## 状态机落地总结

六不变量全部服务端强制并持久化：单活草案（取代事务）、放行但收敛（仅执行中封锁输入）、前沿操作（五路由）、过期即死（末轮限定 + 恢复时落库）、轮次闭合、相位权威（列 + 自愈）。原始三问题（未处理即可继续对话 / 旧草案跨轮可操作 / 僵死忙碌）在模型层面消除。
