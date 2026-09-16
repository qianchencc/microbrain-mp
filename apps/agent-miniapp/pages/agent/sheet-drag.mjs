// vaul 收起语义（Sheet 2.0，2026-09-17 调研定稿）：位移 ≥ 面板可见高度的 25%（CLOSE_THRESHOLD），
// 或带足够位移的向下轻扫（动量优先）。flick 必须同时满足位移门槛：鼠标/模拟器一次点击会合成
// 1~3px 的高"速度" touchmove，无位移门槛时点横杠即被误判为轻扫收起（2026-09-17 预览"点横杆面板消失"）。
// panelHeight 缺省 800px 兜底。
export const shouldDismissSheet = (dragged, flickSpeed, panelHeight = 800) =>
	dragged > panelHeight * 0.25 || (flickSpeed > 0.5 && dragged > 8)
