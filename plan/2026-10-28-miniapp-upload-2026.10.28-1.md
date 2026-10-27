# 小程序上传记录 2026.10.28-1

2026-10-28。用户要求发布小程序。本轮完成「上传开发版」，未提交审核、未发布线上版。

## 上传了什么

- 产物：`unpackage/dist/build/mp-weixin`（发行构建，2026-10-27 23:47，2.1MB；main 1.3MB，`pages/agent/` 918KB）。
- AppID：`wxe60e1f697d115f96`（项目 `智慧园区微脑控制系统V1.0`）。
- 版本号 `2026.10.28-1`，描述「任务/通知读快照与预取、结果文案去核验术语、时间轴点日期定位首卡、首页单行物联助手入口」。
- 命令：`wechatwebdevtools cli upload --project unpackage/dist/build/mp-weixin -v 2026.10.28-1 -d ...`；开发者工具已登录，CLI 返回 `✔ upload`。

产物内容与当前 HEAD 一致（已逐项核对）：`apis/agent/index.js` 含 `readAgentPlans`/`agentReadCache`，`pages/agent/timeline-geometry.js` 含 `dateFocusTop`，`pages/agent/task-presentation.js` 含「暂无结果」，`pages/index/coms/index-con.wxml` 为单行「物联助手」，`static/iot-assistant-icon.png` 与 `common/assets.js` 引用齐全。

## 上传 = 什么，去哪里

- 上传把编译产物推到微信公众平台的「版本管理 → 开发版」，归属该小程序的 AppID，不经过我们自己的服务器（`38.76.215.138` 只提供 API 与数据）。
- 开发版可设为「体验版」供指定体验者扫码验证；要让正式用户用上，需在公众平台「提交审核」→ 审核通过后「发布」。两步都需要客户小程序管理员账号，本轮未执行。
- 开发者工具里能看到效果：IDE/预览/真机调试加载的是本地编译产物，与是否上传无关；上传只决定别人（客户手机、审核）能拿到哪个版本。

## 未做

- 未提交审核、未发布线上版（需公众平台管理员操作）。
- 未做真机交互走查：读快照二次打开速度、点日期定位、结果新文案、首页新图标。
- 发行构建复用 23:47 产物：其后提交只有文档与品牌资源，无代码差异；HBuilderX `cli publish` 需要 DCloud 账号登录，本轮改用既有发行产物上传。
