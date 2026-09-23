// 面板内容视口测量：.device-list 位于 uni-popup 的 v-if 子树内，open 置真后它要等 popup 自己的
// $nextTick（showPopup/showTrans 翻转）才挂载——单次 nextTick 测量会拿到空 rect，导致浮标计数恒为 0。
// 因此打开后做有界重试直到量到非零高度；只在打开/resize 时调度，scroll 回调不查 DOM。
export function createViewportMeasurer({ query, apply, active, delay = 80, attempts = 8 }) {
 let timer = null, left = 0
 function clear() { if (timer != null) { clearTimeout(timer); timer = null } }
 function tick() {
  timer = null
  query(rect => {
   if (rect && rect.height) { apply(rect.height); return }
   if (active() && left-- > 0) timer = setTimeout(tick, delay)
  })
 }
 return {
  schedule() { clear(); left = attempts; tick() },
  dispose: clear,
 }
}
