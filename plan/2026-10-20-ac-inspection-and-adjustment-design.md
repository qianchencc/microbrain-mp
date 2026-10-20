# 空调只读巡检与有界调温设计

## 范围

票 07 和票 08 共用现有 `propose_task`、Task/Phase、`read_json`、scanner、状态读取、`executeDevices`、任务结果和任务收件箱。它们不引入规则引擎、独立调度器或新的 Agent 工具。

## 固定结构

空调检查点使用现有 `phase.read`，增加一个确定性字段：

```json
{
  "deviceIds": ["..."],
  "ac": { "mode": "inspect" }
}
```

票 08 使用：

```json
{
  "deviceIds": ["..."],
  "ac": { "mode": "adjust_to_26" }
}
```

`deviceIds` 是确认时固定的授权成员，排除在提案物化时完成。空调检查必须有有限 `interval` 和至少一个明确检查点；没有检查频次时由 Agent 澄清，或提出有界的默认检查点供用户确认，不由服务器补造无限循环。

## 票 07

每个检查点以新鲜设备自身状态生成 `ac_inspection` 观察块，保留：

- `power`、`mode`、`setpoint`；
- 设备上报时间和本次读取时间；
- `adjustable`、`not_needed`、`unknown` 判定及原因。

该模式不调用控制接口。区间结束后沿现有 interval 收口，不继续检查。

## 票 08

每个检查点先用新鲜状态判断：只有 `power=on`、`mode=cool`、有效 `setpoint<26` 才构造温度 26℃ 动作。下发前再次读取并比较条件快照；状态变化则让行并记为未下发，不重试。既有 `executeDevices` 负责受理、回读和未知结果，未知结果不自动重发。

不自动开机，不切换模式或风速，不使用环境站温度替代空调自身状态。取消或停止复用现有 Task/Phase 语义：后续 pending 检查点停止，在途阶段保留原始结果；interval 结束后不再继续。

## 交付边界

本轮只完成源码闭环和必要静态检查。未部署活动 Runtime，未执行真实设备控制，未新增或运行测试、模型探针和双轴审查。
