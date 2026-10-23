# Company 空调电源指令类型修复与发布

日期：2026-10-23
状态：已修复并发布云端 3210；真实设备开机链路已验收，空调保持开机。
基线：Runtime `a34eb0c`（发布前线上 release `20261023-a34eb0c`），MP 无代码变更。

## 1. 现象

最新 Company 轨迹中，两轮「打开26楼办公区（机房前）空调」草案均正常确认执行，回执为 ACCEPTED，但现场空调始终未开机。设备 `8feece859b9444f78c121e6835c96419`（`YQ-AC-F26-33`）`netStatus=ON_LINE`，`lHeart` 实时，排除离线。

## 2. 根因

Company 空调走物联中心裸属性写：

```text
POST /micro-api/api/iot-center/interactive/{hub}/{actionId}/down
{ "idx": "O", "type": 128, "val": 1, "v": 1 }
```

这台设备的电源属性不是固定类型：详情读回 `O.type` 在关机时为 `128`、开机时为 `129`。适配器把详情里的 `type` 当成写指令类型，开、关都发 `128`，因此“开机”实际是关机/空操作。上游仍返回 `code:0,status:"ok"`，Runtime 记为 `ACCEPTED`，回执与草案看起来都正常。

## 3. 真机证据（同一设备，2026-10-23）

| 时间（CST） | 操作 | 上游回执 | 设备 `O` |
| --- | --- | --- | --- |
| 13:44 / 13:45 | 旧 Company 草案确认 `power:on` | `code:0,status:"ok"` | `val=0,type=128`，`valts` 不变 |
| 13:47 | Office 模板 `AC_OPEN` | 200 accepted | `val=1,type=129` |
| 13:48 | 裸写 `{type:128,val:1}` | `code:0,status:"ok"` | `val=0,type=128` |
| 13:50 | 裸写 `{type:129,val:1}` | `code:0,status:"ok"` | `val=1,type=129` |
| 13:55 | `{type:128,val:0}` → `{type:129,val:1}` | 均 200 | 先 0/128，后 1/129 |

## 4. 修复

`apps/runtime/src/iot/adapter.ts` `controlCompanyAc`：

```ts
const type = field === "power" ? (value === "on" ? 129 : 128) : field === "temperature" ? 136 : 206;
```

温度 `136`、模式/风速 `206` 不变。新增 `company-ac-control.test.ts` 回归，断言开机 `{idx:"O",type:129,val:1,v:1}`、关机 `{idx:"O",type:128,val:0,v:0}`。

验证：定向测试 2/2、`typecheck`、`build` 通过；本地与云端构建哈希一致。

## 5. 发布

- 发布提交：`cb69787`（基于线上 `a34eb0c`），release `20261023-cb69787`。
- 入口哈希：`apps/runtime/dist/server.js` `6a095f9d1b892187217fbaf4010bda7ee62b68c49e930bd98b8c908c59e0f396`
- 变更模块：`apps/runtime/dist/iot/adapter.js` `9d815c1d9bebf13e5cdd1b9eae7a845e04f9ef7ef5ecb6b605ba67e1d7ab9de1`
- 配置契约：`packages/config-contract/dist/index.js` `fd8053df59f4d0282e1b3feee548c0aa5a98467b484354661bb5d5c26ebb90a5`
- 备份：`/opt/iot-agent-runtime/shared/backups/20261023-1402-ac-power-type`（库、sessions、两个 key、runtime.env，0600）。
- 发布前 `quick_check=ok`，无 pending/executing 阶段；发布后行数 `tasks=21`、`task_plans=6`、`report_artifacts=4`、`task_notifications=16`。
- 回环与公网 `/healthz` 均 200（公网约 0.39s）。

## 6. 真实链路验收

1. 先把设备置为 `O=0/type=128`。
2. 通过 `https://mp-agent.qianc.ltd` 新建 Company 会话，发送「打开26楼办公区（机房前）空调，制冷25度」。
3. 生成草案 `5933c65c-6a35-4c25-8fcb-da797553eed9`，动作仅 `{power:"on"}`，`beforeState.power=off`。
4. 确认返回 200、`ACCEPTED`。
5. 约 8 秒后详情读回 `O={val:1,type:129}`，`lHeart` 实时；设备实际开机。
6. 验收会话已通过 `DELETE ...?source=company` 清理。

## 7. 边界与遗留

- 只修 Company 裸属性电源写。Office 走模板 `AC_OPEN`/`AC_CLOSE` 的路径未改，13:47 实测可用。
- 温度、模式、风速协议类型与既有枚举不变；不重放历史失败任务，不回填旧草案。
- 回读窗口仍为 6 秒；电源属性实测约在下发后 7.6 秒更新，因此回执文案可能仍是“指令已受理，暂未取得最终状态”。这是回读时效边界，不是控制失败；随后状态查询可读到 `O=1`。是否把窗口调到 10 秒属于单独的性能取舍。
- 修复提交所在分支 `hotfix/ac-power-type-a34eb0c` 尚未合入 `feat/company-read-cache`；下次从该分支发布前需先合并，避免回退。

## 8. 回滚

```sh
ssh root@38.76.215.138 '
  ln -sfn /opt/iot-agent-runtime/releases/20261023-a34eb0c /opt/iot-agent-runtime/current
  systemctl restart iot-agent-runtime
'
```

数据库本次无结构变更；如确需回滚数据，停服务后使用上述备份覆盖主库与 `.sessions`，再 `quick_check` 并启动。
