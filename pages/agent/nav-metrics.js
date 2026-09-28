// 自定义导航度量：状态栏高度 + 右上角胶囊位置，供页面自绘导航行使用。
// 无胶囊环境（开发者工具部分模式）回落到固定值。
export function navMetrics() {
 const windowInfo = uni.getWindowInfo()
 const top = windowInfo.statusBarHeight || 20
 const capsule = uni.getMenuButtonBoundingClientRect?.()
 return {
  top,
  barHeight: capsule?.height && capsule.top >= top ? (capsule.top - top) * 2 + capsule.height : 44,
  rightInset: capsule?.left ? windowInfo.windowWidth - capsule.left + 8 : 104
 }
}
