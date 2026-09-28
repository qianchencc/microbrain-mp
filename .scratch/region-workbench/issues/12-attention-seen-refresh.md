# 12 — 区域异常提示、已查看与自动刷新

**Spec:** `.scratch/region-workbench/spec.md`（“Runtime：区域目录”“页面与组件”）
**领域:** `CONTEXT.md` 区域异常提示、已查看
**仓库:** iot-agent-runtime + mp

**What to build:** 区域选择列表中，只有存在部分完成或失败、且当前用户尚未查看的任务的区域才显示提示；进行中和已完成不提示。用户打开某区域工作台即对自己消除该区域提示，同事不受影响，任务结果不变。工作台在显示时和可见期间自动刷新，存在执行中任务时刷新更快。

**Blocked by:** 04, 07

**Status:** implemented; pending user miniapp acceptance

- [x] 新增区域查看水位表；`POST /api/agent/regions/:regionId/seen` 记录最后查看时间
- [x] `GET /api/agent/regions` 的 `attention` 按“该用户在该区域存在查看水位之后结束的 partial/failed 任务”计算
- [x] 打开工作台与切换区域时上报已查看
- [x] 区域芯片浮层显示提示；无任何活动点
- [x] 工作台 onShow 刷新、可见期间 30 秒刷新、存在执行中任务时 5 秒，离开页面停止
- [x] Runtime 测试：提示出现、按用户消除、他人仍可见、已查看不改变任务状态
