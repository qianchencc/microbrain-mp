# ask-matt：自然首轮委托对照回传

日期：2026-10-09。当前阶段：隔离诊断完成一个工程情境，生产整改规格未冻结。

## 用户问题与本轮答案

承接“能确保完成一个比目前更优的智能体吗”及 `/$ask-matt 继续`。本轮让真实模型从自然首轮开始，完整运行发现候选、选择南侧、排除格栅灯、改时间、确认、到期执行和同一Task报告追问。

两版都完成这条链，不能把它算作候选新增优势。已有页外目标可读取的局部改善仍成立；候选整体优于现版尚未证明。候选报告遗漏UTC标记，并建议用重新操作确认状态；实际没有产生新操作，但报告质量不能因此直接验收通过。

## 权威材料

- [完整结果与限制](../../iot-agent-runtime-agent-proof/docs/research/2026-10-09-natural-delegation-results.md)。
- [四条对话证据](../../iot-agent-runtime-agent-proof/docs/research/agent-natural-delegation/2026-10-09-trials.json)。
- [范围与实验修订](../../iot-agent-runtime-agent-proof/plan/2026-10-09-natural-delegation-diagnostic-scope.md)。
- [继续工作的交接](../../iot-agent-runtime-agent-proof/plan/2026-10-09-natural-delegation-handoff.md)。

目录为 `/Users/qianchen/works/新发展/iot-agent-runtime-agent-proof`。当前主源码为55a24ba及已记录哈希的并行未提交源码，候选为83d6b50业务源码；不是3200运行构建或干净主提交的验收。

本轮脚本、证据、结果与交接已在隔离分支提交为 `23390cb`；没有合入主Runtime。

## 已确认事实

修正后两版各一条三轮对话，确认前/到期前零模拟下发，扫描两次只下发一次south-strip开灯；没有格栅灯或北侧设备下发。新会话通过真实Task引用解释受理与未确认，追问不生成新提案或新增下发。

初次脚本跨日沿用超过六小时闲置期限的会话，报告请求在模型前404。保留这两次记录；修改仅在验证脚本中检查current并重新进入同来源会话，不修改生产期限。四条对话共12次消息HTTP请求、20个模型generation，完整失败保留，没有以重测隐藏旧记录。

全部设备操作发生在进程内协议夹具；没有真实客户控制、微信操作、3200重启或业务库修改。模型使用真实GLM配置v2。完整上下文保留在隔离目录gitignored var中，临时数据库已清理，没有遗留服务。

## 下一推进单位

先在含最新环境/计量历史和录像能力的冻结基线上，验证原失败的自然首轮、“后者”及整层集合。决定最小取证修正是否必要且足够，再讨论位置分组、结果引用及排除接口；不要整份替换旧候选，不把G1–G4默认当批准规格。

建议技能：ask-matt、diagnosing-bugs、langfuse；工程事实明确后grill-with-docs，再to-spec/to-tickets。继续执行保留真实控制需具体场景确认的边界。
