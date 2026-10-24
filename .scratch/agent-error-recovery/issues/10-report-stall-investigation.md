# 10: 保留报告计算长停的复现线索

**What to build:** 仅在重新复现后定位报告统计占用事件循环数分钟的原因，再以公共报告接口锁定回归。不得在未复现时更改计量口径或顺手重构。

**Blocked by:** 稳定复现或新的安全采样证据。

**Status:** backlog

2026-10-24隔离真实请求 conv 0d7e2aa1-442d-4d60-bf3b-d5296dbe5607，CPU约88%数分钟，loopback2秒超时。只对隔离PID取栈落在meterWindow→bucketCellValue→boundaryBuckets→queryCompanyMeterReport，原模型实际spec未保存；随后同一自然语言输入两次在约10秒计算内完成且spec为六月/43表，未再次复现。现有证据不足以证明数组扫描、期间过宽或原早晨租约失效的触发。堆栈私密原件 `/tmp/recovery-evidence/staging-cpu-stack.json`；后续在报告公共行为 seam 建立可红可绿的时间/响应信号，禁止只据堆栈优化。此线索不伪称已解决，也不成为独立验收设施工程。
