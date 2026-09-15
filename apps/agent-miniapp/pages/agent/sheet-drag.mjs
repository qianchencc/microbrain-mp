// vaul 收起语义：拖过约 1/3 高度，或带足够位移的轻扫（动量优先）。
// flick 必须同时满足位移门槛：鼠标/模拟器一次点击会合成 1~3px 的高"速度" touchmove，
// 无位移门槛时点横杠即被误判为轻扫收起（2026-09-17 预览"点横杆面板消失"）。
export const shouldDismissSheet = (dragged, flickSpeed) =>
	Math.abs(dragged) > 200 || (flickSpeed > 0.5 && Math.abs(dragged) > 8)
