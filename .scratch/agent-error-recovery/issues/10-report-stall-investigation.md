# 10: 保留报告计算长停的复现线索

**What to build:** 仅在重新复现后定位报告统计占用事件循环数分钟的原因，再以公共报告接口锁定回归。不得在未复现时更改计量口径或顺手重构。

**Blocked by:** 稳定复现或新的安全采样证据。

**Status:** backlog

**Priority:** high — 用户明确优先持续运行可靠性。

2026-10-24隔离真实请求 conv 0d7e2aa1-442d-4d60-bf3b-d5296dbe5607，CPU约88%数分钟，loopback2秒超时。只对隔离PID取栈落在meterWindow→bucketCellValue→boundaryBuckets→queryCompanyMeterReport，原模型实际spec未保存；随后同一自然语言输入两次在约10秒计算内完成且spec为六月/43表，未再次复现。现有证据不足以证明数组扫描、期间过宽或原早晨租约失效的触发。堆栈私密原件 `/tmp/recovery-evidence/staging-cpu-stack.json`；后续在报告公共行为 seam 建立可红可绿的时间/响应信号，禁止只据堆栈优化。此线索不伪称已解决，也不成为独立验收设施工程。

2026-10-25只读现场：23:14:54至00:22:14约67分钟，生产67d2a09 active/NRestarts0，46条event-loop-stall告警，最大4459ms；未出现writer lease was lost日志。另有4次身份读取超时与1次草案范围核验超时。新短停证据不等于已复现原数分钟CPU长停或证明同源；后续先建立公开报告/调度响应的确定反馈，再定位，不据告警堆叠猜测修复。窗口内没有新的到期阶段，下一点00:30，不冒称多日稳定验收。
