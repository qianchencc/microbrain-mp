# 独立 Java 业务后端预览

本工作区 `mp-agent-business`，分支 `refactor/java-agent-business-preview`，从 `bf0951ffcfe93a927622ba25f1ac8916b7920388` 创建。原 mp 的缓存工作区和未提交改动不修改。

- develop Agent与视频取流API：`http://127.0.0.1:3215/api`。
- develop播放页：本地 `http://127.0.0.1:9419/owner/h5player/index.html`；播放与CORS由后端业务票09实际验收，配置存在不代表视频已通过。
- trial/release地址不变，登录及组织确权保持客户原链路；没有注入token、消息或假数据。
- 仅精确迁入原mp中已验证必要的登录修复：普通无token启动正常登录；getToken与storageSet成对反序列化；首次园区选择使用currentDistrict。没有整包复制缓存修改和无关格式变化。
- HBuilderX仅编译本工作区，生成目录 `unpackage/dist/dev/mp-weixin`。微信新窗口 `Agent Business WT - Java 3215`，自动化9441；原窗口/9431不动。
- 权威推进及真实截图证据位于同级backend业务worktree的 `.scratch/agent-business-recovery/`。本机独立窗口启动流程和资源隔离详见该目录 `local-preview.md`。
- 已在独立窗口实际打开首页/仪表盘/办公室，并输入说明书只读问题取得4盏灯状态。该单例是环境和基线证据，不代表Node通用化或全部说明书通过；没有执行控制、创建任务、发送通知。
