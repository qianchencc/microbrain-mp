// 键盘停靠：textarea 组件级 bindkeyboardheightchange 在键盘动画起点回调，
// detail = { height, duration }；duration 单位各端不一致（iOS 秒 / Android 毫秒级），
// 归一到毫秒并封顶 400ms，供 composer-shell padding-bottom 过渡对齐键盘节奏。
export function resolveKeyboardDock(event) {
  const detail = event?.detail ?? {};
  const height = Math.max(0, Number(detail.height) || 0);
  const raw = Number(detail.duration) || 0;
  const durationMs = Math.min(400, raw > 20 ? raw : raw * 1000);
  return { height, durationMs };
}
