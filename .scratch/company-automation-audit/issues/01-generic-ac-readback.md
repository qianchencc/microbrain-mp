# 01: 普通Company空调关闭按准确的权威事实核验

Status: implemented-and-deployed (Runtime d1f39fc)
Priority: high
Blocked by: none

## 问题与来源

生产48efa8b的普通关闭仍按freshSinceMs过滤属性，commandAtMs却取整批下发结束时刻。设备时钟落后、或早期设备的状态在整批结束前已经更新，均会让已关闭设备成为unconfirmed。条件调温已有单独snapshot回读策略。生产17:00任务5台ACCEPTED/unconfirmed与此一致，但不能断言同源。

完整证据和界限见[核账报告](../../../plan/2026-10-26-company-automation-reliability-audit.md)，探针在[probes](../probes/generic-close-verification.test.ts)。探针复用Runtime进程内网关，复制到干净生产基线 `apps/runtime/test/` 后用Node22+tsx运行，当前两项均复现。依赖已有company-night-closure-fixture。

## 冻结业务范围

只完成Company普通空调关机的确认→执行→准确回读→原Task/通知展示。审视与条件调温共用的权威面板契约，保留实际回执和逐项事实。即时空调若共用改动须验证其契约，Office/照明/门禁不随之放宽。

不重跑旧Task，不把当前状态回填历史，不把ACCEPTED升级为verified。新的真实控制须另有具体设备授权；本票默认用隔离协议夹具和生产原对象只读复核。

## 验收

- [x] 公共HTTP反例先红后绿：属性时钟落后、批量先完成设备均有正确核验；无变化、读取失败、明确拒绝、未知保持真实结果。
- [x] 实际写入计数覆盖确认回放、重扫、重启；没有重复下发，绑定/撤权和确认仍有效。
- [x] Task、报告、通知和即时共享路径保持一致，旧终态记录不变。
- [x] 对所选快照/字段契约记录理由和证据限制；扩大容差或受理当成功不能代替修复。
- [x] 沿当时生产基线构建；工程验证与是否发布分别记录。

## 交付

2026-10-26，用户认可方向后实施第一片。生产基线48efa8b，源码/发布d1f39fc；422/422、typecheck/build和双轴审查通过。真实只读3台面板新旧规则对照、两个原Task的终态/报告不变通过；没有新增真实设备控制。见[交接](../../../../iot-agent-runtime/plan/2026-10-26-company-ac-readback-handoff.md)。性能提速和后台有限核验属于后续片。
