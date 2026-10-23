# 设备位置权威口径：电表楼层归类与摄像头区域树路径（2026-10-19）

## 背景与问题

用户提出三问：

1. “农旅”电表是否因名称不含“26楼”被分到公司楼层之外？
2. 上游把名称改成“26楼开头”后系统是否恢复正常？
3. 摄像头是否同样“名称决定位置”？上游改名后系统是否及时刷新？

已核实的真实上游数据（只读接口）：

- `26楼农旅研究院电表`，`areaName=26楼农旅研究院`
- `农旅办公室电表`，`areaName=26楼农旅办公室`
- 智慧监控区域树为“新世纪发展集团 / 26楼 / 全部”；摄像头 `installAddress` 为空，名称形如“监控-26楼…”。

## 根因

### 电表（小程序仪表盘）

- Runtime 正式电表报告（`meter-report.ts`）一直用 `areaName` 楼层前缀，两台都归 26 楼，无问题。
- 小程序仪表盘逐日能耗 `pages/agent/energy-daily-view.mjs` 的 `floorOf(meter.name || meter.location)` **名称优先**，且对含“农旅”的名称特判归“农旅”分组——`农旅办公室电表` 因此被从 26 楼拆出。
- 上游改名可绕过现象，但不可靠；正确修法是位置优先。

### 摄像头（Runtime）

- 智慧三族采集 `collectCompanySmartDevices` 只保留叶子 `smartAreaCode`，未保留人类可读区域树路径。
- 监控记录 `installAddress` 为空时以**设备名兜底**，位置事实上由名称决定：改名去掉楼层即丢失楼层归属；名称写错楼层则误配。
- 安全事件关联监控 `reviewSafetyEvent` 的楼层判定只用 `installAddress + name` 文本。

## 改动

### mp（楼层构成位置优先）

- `pages/agent/energy-daily-view.mjs`
  - `meterRows`：`floorOf(meter.location || meter.name || '')`，位置（上游 areaName）优先，表名兜底。
  - `compositionFromUsage(meterUsage, placeOf)`：参数语义改为“权威位置文本”，与 `meterRows` 同口径。
- `pages/agent/dashboard.vue`：`meterNameOf` → `meterPlaceOf`（`location || name`）。
- 回归测试 `test/agent-energy-daily.test.mjs`：
  - `农旅办公室电表 + location=26楼农旅办公室` 在逐表行与楼层构成中必须归入 26 楼；
  - `placeOf` 归组：`26楼农旅办公室` → 26 楼，无楼层的 `农旅研究院` 仍走农旅兜底；
  - location 缺失时表名兜底保留。

### iot-agent-runtime（区域树路径 + 自身楼层优先）

- `apps/runtime/src/iot/adapter.ts`
  - `collectCompanySmartDevices` 走树时携带区域名路径（根→叶子，聚合“全部”不作路径），记录新增 `locationPaths: [areaPath]`——与智慧空调同一机制，目录词表/检索自动受益。
  - `deviceLocationText`：设备自身文本（名称/安装位置）已写明楼层时**只返回 installAddress**（等价既有行为）；自身缺楼层才并入区域路径。理由：整层“全部”叶子页可能含异楼层记录（如名为 27楼 的设备），粗树节点不得把它带进 26 楼检索；反向，名称无楼层的设备（如“货梯口监控”）借路径获得楼层归属，不因改名丢失。
- `apps/runtime/src/safety/events.ts`
  - 楼层判定 `floorOfDevice`：自身文本楼层优先，区域路径兜底（与 adapter 同规则）。
  - 候选 `location` 展示：`installAddress` 与名称相同（名称兜底污染）时改显区域树路径，不再把设备名冒充位置。
- 测试：
  - `company-smart-devices.test.ts`：新增无楼层名监控“货梯口监控”，断言其按区域路径归入 26 楼并可被发现；实时监控卡断言同步更新。
  - `safety-camera-review.test.ts` 新增用例：两级区域树下，名称与安装位置都不含楼层的监控按路径入选 27 楼告警候选，28 楼监控不混入，位置展示为“新世纪发展集团 / 27楼”。

## 名称更新时效结论（调查事实，未改代码）

- Company 电表/设备目录每次请求读上游，无长期缓存；上游成功返回后新名称/areaName 在下一次目录、报告、候选查询生效。
- 上游失败时存在有界 observation fallback 窗口，期间可能显示旧数据；Office 侧另有约 60 秒目录缓存，不能套用到 Company。
- 已生成的报告、任务快照、录像卡、已保存观察是事实快照，不因改名回写；重新查询才读新名称。
- 已打开页面/当前对话上下文可能持旧名称，需重进或重新发起查询。

## 验证

- mp：`node --test test/agent-energy-daily.test.mjs` 13/13；`npm run test:agent` 104/104。
- runtime：全量 `tsx --test` 269/269；`npm run typecheck -w @iot/runtime` 通过；`npm run build` 通过；`git diff --check` 干净。
- 修复过程中曾出现两处回归并已修正：
  1. `leaves` 结构改造后 `leaf.fullCode` 引用未同步为 `leaf.node.fullCode`（导致目录采集失败）；
  2. 区域路径置于设备文本之前时，整层叶子页中的异楼层设备借路径混入本层检索（mixed-scope 系列 8 个用例失败）——最终规则为“自身楼层优先、路径兜底”。

## 提交边界（未提交，待用户确认）

- mp 工作区混有用户并行改动（`EnergySkeleton.vue`、`completeDayComparison`、标题行布局等），本轮 mp 改动仅：
  - `pages/agent/energy-daily-view.mjs`（floorOf 口径）
  - `pages/agent/dashboard.vue`（meterPlaceOf）
  - `test/agent-energy-daily.test.mjs`（回归）
  - `pages/agent/AGENTS.md`（规范句）
- runtime 工作区另含位置分组设计线未提交改动（根 `AGENTS.md`/`CONTEXT.md`/`.scratch/agent-location-groups/`），本轮 runtime 改动仅：
  - `apps/runtime/src/iot/adapter.ts`
  - `apps/runtime/src/safety/events.ts`
  - `apps/runtime/test/company-smart-devices.test.ts`
  - `apps/runtime/test/safety-camera-review.test.ts`
  - `apps/runtime/src/AGENTS.md`（规范句）
- runtime 仓库根存在 `:memory:.sessions*` 疑似 SQLite 误落盘产物（约 14MB），不属于任何工作线，建议单独清理或加 gitignore。

## 名称时效实测（2026-10-19 15:33 本地，只读）

用户反馈“上游应已重命名农旅电表，系统仍滞后”。只读探测结论：**滞后不在本系统，上游能耗模块主数据本身未改名**。

| 层 | 农旅办公室电表（id 87da0cb1…） | 证据 |
| --- | --- | --- |
| 上游 `/energy/equipment/page` | `农旅办公室电表` / `areaName=26楼农旅办公室`，**`modifiedAt=2024-05-29 16:28:16`**（2024-05 后该记录从未被修改） | 探测两遍一致 |
| 上游 `realTimeRead/page`、`electricData/page` | 同为 `农旅办公室电表`（上游行内冗余名称） | 与主数据一致 |
| 远端 Runtime `company-devices` / `company-energy-daily` | `农旅办公室电表` / `26楼农旅办公室` | observedAt=2026-10-19T07:33Z，与上游逐字一致 |

- 另一台 `26楼农旅研究院电表` 本就带前缀（modifiedAt 同为 2024-05-29）；若用户印象中的“已改名”来自它，则从未发生办公室电表的改名。
- 若客户确在其他界面（如物联/iot-center 设备管理）改过名：能耗模块的计量点主数据是独立表，需客户在**能耗/计量点管理**里改 `equipmentName`，或书面确认两处主数据的同步责任。
- 本系统时效链路实测：Company 目录即时跟随上游（约 17 秒为逐源采集耗时，非缓存滞后）；Office 60s 目录 TTL、观察目录失败兜底 30 分钟窗口维持此前结论。
- 即便上游不改名：`areaName` 已是 26楼，前端位置优先修复上线后仪表盘即正确归层。

## 改名落点实测闭环（2026-10-19 16:40–17:00，只读）

用户在管理界面给运营部电表名称加"1"后仍看不到变化。根因确认：**客户平台存在两张独立主数据表，改名只写进了其中一张**。

| 上游表 | 运营部电表当前名称 | 证据 |
| --- | --- | --- |
| iot-center 设备表（截图的管理界面） | `电表-26楼运营部1`，安装位置 `26楼运营部1` | code C-E-F26-019，详情/目录接口均返回新名 |
| 能耗计量点表（`/energy/equipment/page`，本系统电表名称唯一来源） | `26楼运营部电表`，areaName `26楼运营部` | modifiedAt=2024-05-30 18:25:33（version 5，从未被这次改名触碰） |

- 计量点全字段已核对：**没有任何指向 iot-center 的关联键**（无 code/hubDeviceId），两张表只能靠名称/区域模糊对齐，不可能自动同步名称。
- 结论：不是本系统同步问题。要让小程序电表名变化，客户必须在**能耗模块-计量点管理**里改 `equipmentName`；本链路实测对上游即时跟随，无需改动。
- 产品备注：iot-center 名称（"电表-26楼运营部1"）与计量点名称（"26楼运营部电表"）今后会持续分叉，属客户主数据治理问题，可列入客户支持项。iot-center 设备表虽有 `relDeviceId/relDeviceCode`（关联设备）字段可承载两表关联，但该电表上为空——客户若要"改一处、处处生效"，正路是补上关联或在能耗模块改名；iot-center 侧电表档案无任何读数（`actionList:null`），计量数据不可能改从 iot-center 取。

## 后续

1. mp 需 HBuilderX 重新编译后微信开发者工具验收仪表盘楼层构成（农旅办公室电表归 26 楼）。
2. 运行中 3200/远端 Runtime 更新部署后，验证真实安全事件监控候选与目录检索。
3. 明确结论：上游改名可临时绕过现象，但不能替代结构化位置字段；电表看 `areaName`，智慧设备看区域树路径 + 自身文本优先规则。
