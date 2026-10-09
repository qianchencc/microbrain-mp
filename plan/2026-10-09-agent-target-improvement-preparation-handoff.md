# Agent 目标优化：规格准备交接

日期：2026-10-09。当前阶段：ask-matt → to-spec / to-tickets准备。用户认可优化现有方案，三票粒度与测试入口待一次合并确认。生产业务尚未修改。

## 下一步

阅读[规格](2026-10-09-agent-target-improvement-spec.md)和[三票拆分](2026-10-09-agent-target-improvement-tickets.md)。确认后向mp的本地tracker发布三个独立票据，按阻塞顺序从01开始；不能从旧位置分组spec的ready标签开始重建全部工具。

首票在最新Runtime主线的隔离分支实施，先通过现有公开HTTP复现页外目标的委托失败，再补必要取证能力，贯穿确认、夹具到期执行与同一报告追问。旧候选分支仅供参考，不能覆盖最新录像和安全事件功能。

## 工作区边界

本轮读取时Runtime HEAD为41ca5d8，未提交CONTEXT.md与位置分组探索目录；mp HEAD为41423da，存在并行H5播放器与测试修改，以及社区研究文档和个人gen.py。这些都未纳入本轮文档。实际实施前再次检查Git状态，禁止恢复、删除或混入这些文件。

本轮未调用客户物联接口、未触发设备控制、未重启3200，也未创建线上Langfuse数据集。此前对照证据与局限见[自然委托回传](2026-10-09-agent-natural-delegation-return.md)和[逻辑推演](../docs/research/2026-10-09-agent-old-new-logic-walkthrough.md)。

## Suggested skills

- ask-matt：按当前阶段继续，避免回到未经确认的全量新方案。
- implement、tdd：一次一个完整票据，公开行为红绿回归。
- diagnosing-bugs：先建立能捕捉原症状的反馈循环，再调整工具、上下文或守卫。
- langfuse：真实模型对照的证据与边界，不能把工程样例冒充独立可靠性评测。
- code-review：稳定切片收口时一次规范/规格审查。
- handoff：每个业务闭环完成后按用户要求记录到plan/。
