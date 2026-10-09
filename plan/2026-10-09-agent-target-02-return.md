# 完整照明范围与prompt优化回传

2026-10-09。票02完成源码闭环、双端HTTP、真实模型及原生模拟器夹具；本机唯一3200已更新。真实设备控制与手机验收未进行。

## 起点与结果

批准范围见[优化规格](2026-10-09-agent-target-improvement-spec.md)与[三票路线](2026-10-09-agent-target-improvement-tickets.md)。旧主线在整层查询超过50台后停在缩小/分批建议，不能完成原委托。现在完整照明查询成员由服务器固定保存，模型引用包含集合与实际排除子集，生成既有具体草案。空排除、近似排除和范围外排除须先解决，不能忽略限制。

88台夹具设备中，4台会议室排除，1台已关闭，83台待关闭。Company与Office公开接口和真实模型都走通；确认前零下发，确认后只操作批准83台；新增设备不加入，撤权拒绝，重复确认不重复下发。没有重写Task/Plan或scanner，没有新增前端集合编辑器。

## Prompt

双端共用设备发现与操作提案规则，分别标明范围、软描述、完整成员、明细窗口、排除、引用及确认边界。来源能力和环境/计量/视频等业务规则仍各自保留。旧description中“超过50台不能草案”的笼统规则已同步修正，不只在system末尾追加相互冲突的指令。

原票01四轮真实模型复验还暴露UTC报时错误：09:00Z被误称09:00中国标准时间。修正为按同一瞬间换算+08、加8小时并处理跨日后，复验正确回答17:00CST/09:00UTC，灯带目标、执行和报告没有新增控制。

未知排除有一次最后回答生成超时，后续复验澄清成功；超时和所有其他失败均保留。旧prompt配新工具也曾成功，所以不能归因成prompt单独提高成功率，也不能保证整个Agent已更优。详细试验及审查见Runtime [结果记录](../../iot-agent-runtime/docs/research/2026-10-09-agent-target-02-results.md)及[交接](../../iot-agent-runtime/plan/2026-10-09-agent-target-02-handoff.md)。

## 原生卡片

复用现有草案、概览与单层Sheet，无UI源码改动。将现有微信编译产物复制到临时项目，网络、存储写及无关蓝牙初始化只在该VM截留；不访问真实Runtime或设备。首轮游客AppID启动失败已记录，改用项目AppID后仍保持完全隔离。

- [草案统计](../docs/research/agent-target-02/draft.png)：共找到88、拟执行83、不动5。
- [查看全部末行](../docs/research/agent-target-02/last-row.png)：类型分组可滚至LGT83，83张卡，无会议室待操作卡。
- [会议室排除](../docs/research/agent-target-02/excluded.png)：概览有4项已排除。
- [执行收据](../docs/research/agent-target-02/receipt.png)：原生点击发送一次Company confirm，显示83项受理；[调用记录](../docs/research/agent-target-02/confirmation.json)与[列表记录](../docs/research/agent-target-02/final-ui.json)保存同一事实。

临时窗口已关闭，客户工作区、登录存储和开发包源码未改写。该走查仅证明现有原生组件可承载完整草案，不代表真机、现场控制或最新全部并行前端改动验收。

## 运行与继续

Runtime实现0dcdcba、审查修正401940e已合入主线。全量128/128、最终9项定向、类型与构建通过；规范与规格发现已关闭。确认无在途对话/阶段后，唯一0.0.0.0:3200受控更新，原客户网关、real-runtime.sqlite、配置v2与密钥保留。healthz正常、真实Company摘要只读HTTP200且errors=[]。重启后管理员需重新登录。

下一票03：同一固定包含/排除集合用于定时和周期模板，当前已满足设备也保留未来目标。现有精确设备任务继续可用；集合式未来目标尚未接入。现场整层控制、真机及部署后真实模型委托需另做具体场景验收。

建议技能：ask-matt沿已批准implement/tdd路线推进03；prompt实际失败先按langfuse prompt-engineering定位；稳定闭环用code-review与handoff。公开HTTP seam已有授权，不再重复请求确认。
