# 自动化结束通知接线事实核对

日期：2026-09-30。状态：S02 事实调查完成；尚未冻结 spec、尚未实施或验证真实推送。

## 范围与已确认决定

- 用户确认：成功和异常的自动化结束都发通知。通知对象、取消是否作为结束通知、周期发生的授权不足体验仍待产品决定。
- 调查链路：订阅授权 → 可信接收人 → 整项任务结束 → 后台发送 → 投递结果 → 任务详情。
- 本轮仅读源码和官方公开文档，没有登录客户平台、调用绑定接口、运行云函数、发送订阅消息、触发设备操作。没有读取或记录真实 openid、个人资料、云端凭据。
- 小程序 worktree：`/Users/qianchen/works/新发展/mp`；Runtime：`/Users/qianchen/works/新发展/iot-agent-runtime`。下文 `mp/`、`runtime/` 分别指这两个绝对路径。

## 结论

现有客户小程序有前端订阅调用和 uniCloud 发送模块，但 Agent 没有保存授权结果、可信接收人映射、任务终态投递记录或后台发送接线。不能称为只缺一处调用，也不能把已有模板 ID 或云函数源码当成生产配置已可用。

一期可以沿用 `requestSubscribeMessage` 和 `uni-subscribemsg`，以一项真实 Task 结束作为一个通知事件。周期任务每次发生使用真实 Task 身份，不能在创建计划时把一次订阅解释为未来永久发送许可。

同轮根代理只读实测 `/account/me` 两次均为 HTTP/code=200，`content.id` 为相同非空字符串，响应没有 `principalId/openid/wxOpenId`，证据见 [S01 身份核对](2026-09-30-recurring-principal-readonly-verification.md)。`mp/store/modules/user.js:115` 获取该资料，`:116` 已使用 `userInfo.id`。因此业务主体已有候选来源，需确认其生命周期/唯一性契约；待补的是可信openid映射，不能笼统写成“没有用户ID”。本报告未保存响应原文或个人标识。

## 微信官方规则核对

### 授权不是发送余额

`requestSubscribeMessage` 必须在点击等平台允许的时机调起；接口 success 表示调用成功，须逐模板读取 `accept/reject/ban/filter`。当前官方页写明一次最多 5 个模板，不能沿用旧镜像的 3 个。一次性和长期模板不能混用，同标题模板可能被过滤。[微信 requestSubscribeMessage](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)

一次性订阅允许订阅后发送一条对应服务消息；长期订阅需要匹配开放行业，设备订阅还需要完成设备接入。当前还存在长期限频类型，资格和频次由模板约束。“总是保持选择”保存订阅设置，后续调用可能不再弹窗，不能把该设置理解成无限次数。[微信订阅消息总览](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)、[弹窗订阅开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)

因此 `accept` 可以记录为某次申请的结果；`getSetting` 可以用于展示设置。二者都不是服务端实时剩余次数查询。本地余额即使根据申请和发送估算，也不能成为权威事实：其他客户业务可能使用相同模板发送，用户还可能改变设置。发送返回 `43101` 官方明确包含未订阅以及一次性次数已经用完。[微信发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

### 模板与新能力不能推定适用

模板必须来自该小程序的模板配置，字段必须按选用模板规定发送；模板错误、字段不合法应作为配置问题，不能误报未授权。[微信发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

新版一次性订阅 Beta 使用特定业态与平台模板，接入方式为支付订单或 `liveActivity` code，且不兼容旧模板的订阅/发送方法。本轮检查列出的业态未发现通用物联任务完成类型，不建议将其作为一期默认替代方案；是否有新增可用模板须客户后台确认。[新版一次性订阅开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-2.html)

不能为了满足周期推送而预设客户具备长期模板资格，或把普通成功通知套入要求人工介入的设备消息。[微信订阅消息总览](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)

### 发送受理、下发与阅读分开

发送需要该小程序的 `touser` openid、`template_id`、模板 `data`；`page` 仅支持本小程序页面且可带参数，`miniprogram_state` 用于开发/体验/正式环境。[微信发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

同步成功应在我方记录为“微信接口已受理”。官方提供 `subscribe_msg_sent_event` 下发结果事件，带 `MsgID/ErrorCode/ErrorStatus`；接入客户已配置的消息推送服务器后，才有平台下发结果证据。回调成功也不能证明用户已阅读、系统横幅出现或用户已处置。[弹窗订阅开发指南：事件推送](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html#订阅消息事件推送)

发送页当前返回字段表未列 MsgID，但事件指南称接口会返回；真实接口/SDK返回中是否有该字段、能否可靠关联，需要开发验收，不能用邻近时间强猜消息归属。

## 逐段代码事实

| 环节 | 已有事实及证据 | 可复用 | 必须补齐/修改 |
| --- | --- | --- | --- |
| 前端订阅 | `mp/utils/subscribeMessage.js:4` 根据菜单取模板；`:12` 调用 `uni.requestSubscribeMessage`，`:14` 和 `:15` 丢弃成功和失败结果 | 平台 API 调用模式 | 返回逐模板结果与失败原因；Agent确认点击接入；不能用成功回调直接写“已授权” |
| 模板配置 | `mp/config/subscriptionsSetting.js:1` 配置访客、事件、会议、巡检、卡证模板；没有 Agent 完成通知配置 | 客户配置文件归属 | 取得实际模板名称、字段类型、类目及一次性/长期属性；新增 Agent 键或明确复用；现有 event ID 适用性未证 |
| openid来源 | `mp/apis/user/principal.js:34` 定义 code 换票；`mp/store/modules/user.js:80` 的 thirdLogin 将结果 openid 用于客户登录 | 既有客户微信登录 | 仅证明登录流程可取得 openid；没有证明 Runtime 能取得可信 principal→openid 映射 |
| openid绑定 | `mp/apis/user/principal.js:37` 定义 `userUpdateOpenId`；全仓调用搜索仅见此定义和 `mp/store/modules/user.js:5` import | 客户可能已有绑定API | 当前 thirdLogin 未调用绑定函数。不可按历史报告断言现行绑定链路已执行；不在本轮调用该 GET 写接口 |
| 云函数入口 | `mp/uniCloud-aliyun/cloudfunctions/weixin-mp-push/index.js:3` 实例化发送器；`:8` 支持 HTTP body；`:14` 直接转发发送参数 | 发送模块、包装入口 | 单凭 context.SOURCE 不构成鉴权。需受信服务间鉴权、固定模板、服务端接收人解析和字段校验；当前入口未见这些约束 |
| 配置匹配 | 云函数使用的 dcloudAppid 与 `mp/manifest.json:3` 一致 | 不能再称这个值为确认无关的示例AppID | 一致只证明仓库匹配，不能证明已绑定云空间、生产部署、appid/appsecret及模板可用 |
| 模块依赖 | `mp/uniCloud-aliyun/cloudfunctions/weixin-mp-push/package.json:4` 引用本地 uni-subscribemsg；模块 package `:13` 引用 uni-open-bridge-common 与 uni-config-center | 已安装依赖，无需新引入基础推送SDK | 生产安装与版本、云配置可用性需实际部署证据 |
| 微信发送 | `mp/uni_modules/uni-subscribemsg/uniCloud/cloudfunctions/common/uni-subscribemsg/service/weixin-mp.js:12` 解构发送参数，`:21` 取 access_token，`:27` POST微信，`:44` 包装结果 | 微信协议及凭据获取 | 必须检查原始 `result.errcode === 0`；当前 `errCode: result.errcode || 0` 会把缺失errcode也包装为0。不要只检查包装字段 |
| app凭据管理 | `mp/uni_modules/uni-open-bridge-common/uniCloud/cloudfunctions/common/uni-open-bridge-common/config.js:47` 读uni-id配置，`:87` 解析oauth；`index.js:27` 定义 AccessToken 缓存/回源 | 云端 access_token 获取，不向客户端下发AppSecret | 客户空间配置、生产凭据、是否与其他服务争抢同一token尚未验证；不能与任务创建者业务Token混为一谈 |
| 任务终态 | `runtime/src/tasks/store.ts:113` 聚合阶段为Task状态；`:116` 识别仍有待执行/执行中阶段；`:126` 终态清除任务凭据；`runtime/src/tasks/scanner.ts:17` 处理阶段 | 整项任务结果和现有 scanner/store | 终态事务内产生唯一通知记录；覆盖正常完成、部分完成、失败、中断、错过和后续确认的取消；不能每个阶段都发 |
| Runtime接线 | 对 `runtime/src` 搜索 openid/openId/notification/recipient/outbox 未发现通知实现，subscribe仅为Agent事件监听 | 现有公共HTTP、数据库和Task对象 | 可信接收人映射、订阅结果关联、通知持久化、发送worker、重启恢复和结果回调 |
| 深链 | `mp/pages/agent/region.vue:66` 读取 regionId/date/taskId；`:140` 校验选区；`:149` 在当日真实任务中查目标并开详情；`:30` 使用TaskDetailSheet | `pages/agent/region?regionId=…&date=…&taskId=…` | 检查登录恢复后参数保留、权限撤销、历史跨日任务、目录不可见和任务不存在提示；URL不得含token/openid |

DCloud官方说明公共模块仅在云函数/云对象内运行、依赖 uni-open-bridge 配置，发送支持 page 与环境字段。因此 Runtime 接客户云端发送能力是合理复用方向，但不能在 Runtime 中直接加载这个uniCloud公共模块。[DCloud uni-subscribemsg](https://doc.dcloud.net.cn/uniCloud/uni-subscribemsg.html)

## 建议的最小可靠闭环（尚待spec冻结）

1. 用户确认真实Task时，从允许的点击链路申请对应模板，记录逐模板结果；订阅拒绝不改变设备执行结果。
2. 服务端按经验证的业务主体查该小程序openid。不能相信任意前端传入的收件人，不把openid升为计划归属主体。接收人由产品决定后固定快照。
3. Task第一次达到整项终态，在同一个存储事务写出待投递记录。建议唯一键为 `(taskId, endEventId, recipientPrincipalId, channel)`，或冻结一期Task不可重开后使用相应简化键。重启扫描与重复回调不能生成第二次通知。
4. sender领取记录后调用受信云端入口。明确保存 pending/accepted/failed/unknown/no_subscription 及原始安全错误码；平台下发回调和用户打开另存事实，不替代任务状态。
5. 明确失败可分类重试；网络超时/进程在调用后崩溃可能已经消耗订阅次数，应记unknown并查证，不能立即重发。现行小程序发送接口和本地模块没有我方可传的幂等字段，数据库去重只保证我方重复领取被阻止，不承诺跨网络恰好一次。公众号的client_msg_id不适用于这条小程序链路。
6. `43101` 记订阅不足/无可用授权，不无限重试。模板错误、字段错误、openid错误记配置/映射失败；access_token失败由发送服务受控更新后有限重试。[发送接口错误码](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)
7. 点击通知走已有区域详情深链，重新校验当前权限。结果文案基于任务和逐设备回执：平台受理可表述“执行流程已结束，指令已受理”，不能写成物理目标全部已核验。现行规则见 `runtime/src/tasks/AGENTS.md:14`。

“所有结束都通知”是触发策略，不等于微信在订阅不足时仍可发送。周期计划可以为每次真实发生生成上述记录；一次性授权耗尽后必须诚实显示无法发送，不阻断Task结果可查询。

## 需要客户提供的最小清单

| 项目 | 要拿到什么 | 原因 |
| --- | --- | --- |
| 实际模板 | 模板名称、字段键和类型、所属类目、订阅类型及适用说明 | 现有event模板是否表达任务完成尚未证实 |
| 可信接收人 | 业务principal与本小程序openid映射查询契约、绑定维护归属；可通过客户后端或受信身份交换实现 | 前端登录能拿到openid不证明后台定时发送可以可信取到 |
| 云端发送位 | 生产uniCloud空间/部署状态、受信调用方式、AppID匹配、服务器端密钥配置的存在性 | 仓库代码可用不等于生产服务可达；不索要明文密钥写入文档 |
| 平台回调 | 消息推送服务器归属、验签/解密与subscribe_msg_sent_event转发契约 | 区分接口受理与最终下发；验证MsgID关联 |
| 真机验收 | 客户授权的测试用户与订阅/发送窗口，开发或体验环境目标页 | 未经授权不在本轮产生真实推送 |

## Matt流程位置与下一步

- S02 当前在 `research → grill-with-docs`：事实已整理，不代表完成通知功能。
- 产品仍须确定：收件人；手动取消是否发；订阅不足时补授权入口与是否补发旧通知；周期通知如何持续取得机会。
- 用户已确认的“成功与异常都发”不要再次询问。
- 决定后写领域词汇/ADR、`to-spec → to-tickets`。首张业务票应完成一项Task的授权、终态投递、结果可见与详情深链；客户依赖单列阻塞边。
- 外部验收通过后才可宣布通知接通；当前没有运行生产发送测试，也没有校验微信真机下发、点击或用户阅读。

## 调查方法与未核验项

源码按上述路径和行号只读核对；对 Runtime src 搜索通知相关标识；微信页面 web读取失败后用curl直读官方HTML成功。旧OpenApiDoc发送链接重定向为接口目录，本记录采用现行server/API发送页。官方API页明确上限5，与旧二手镜像不同。

未核验：客户模板后台内容/类型、云空间配置及部署、线上openid绑定是否已由其他服务完成、剩余订阅次数、HTTP入口云平台外层鉴权、MsgID实际返回、回调关联、跨登录深链和真实微信环境通知效果。未将这些未知项写成阻塞业务身份本身或已有接口不可用。
