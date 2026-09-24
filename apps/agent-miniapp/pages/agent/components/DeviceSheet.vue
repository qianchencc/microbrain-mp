<template>
 <uni-popup ref="popup" type="bottom" :is-mask-click="true" :safe-area="false" background-color="transparent" mask-background-color="rgba(20,35,28,.32)" @change="onPopupChange">
  <view class="sheet" :class="{ tall }" :surface-reset="surfaceReset" :change:surface-reset="sheetGesture.resetSurface">
   <view class="handle-zone" :data-threshold="dismissThreshold" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="sheetGesture.handleStart" @touchmove.stop.prevent="sheetGesture.handleMove" @touchend.stop="sheetGesture.handleEnd" @touchcancel.stop="sheetGesture.handleCancel"><view class="handle" /></view>
   <view class="header-top"><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text></view><text v-if="meta" class="meta">{{ meta }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><slot name="header-right" /></view>
   <view class="header-slot"><slot name="header" /></view>
   <view class="sheet-body"><slot /></view>
  </view>
 </uni-popup>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, openRequest: { type: Number, default: 0 }, title: String, subtitle: String, meta: String, tall: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const popup = ref(null)
const visible = ref(false)
// WXS setStyle 写入的拖拽位移不受 Vue 虚拟 DOM 管理；uni-popup 会复用槽位节点。
// 每次打开前递增渲染层 prop，由 WXS 自己清除残留 translateY，避免只剩遮罩。
const surfaceReset = ref(0)
const windowHeight = uni.getSystemInfoSync().windowHeight || 600
const dismissThreshold = Math.round(windowHeight * 0.78 * 0.25)
let reopenTimer
let requestedClose = false
watch(() => [props.open, props.openRequest], async ([value, request], [oldValue, oldRequest] = []) => {
 if (value) {
  requestedClose = false
  if (oldValue && request !== oldRequest) visible.value = false
  surfaceReset.value++
  await nextTick()
  if (props.open) ensureOpen()
 } else if (visible.value) {
  requestedClose = true
  stopReopen()
  popup.value?.close()
 }
}, { immediate: true })
// uni-popup 的 open() 在其关闭动画结束前（内部仍视自己为打开）会静默返回，既不显示面板也不发任何事件，
// 且此时 open 属性已为 true，父级不会再产生变化来重新触发。唯一可靠的依据是 change{show:true} 反馈：
// 调用后没等到就周期重试，直到面板真的打开或不再被要求打开。对已打开的面板重调 open 是无副作用幂等。
function ensureOpen() {
 stopReopen()
 if (!props.open) return
 popup.value?.open('bottom')
 reopenTimer = setTimeout(() => {
  if (!props.open || visible.value) return
  // 重试时按真实 popup 状态对账：showPopup && showTrans 才代表物理层确实在展示
  // （仅 showPopup 为真可能只是 300ms 关闭动画未播完，须继续重试等它销毁）。
  // 影子状态失真时校正 visible 而不是无限重试——这也让之后的 props.open→false 关闭路径重新可用。
  if (popup.value?.showPopup && popup.value?.showTrans) { visible.value = true; return }
  ensureOpen()
 }, 350)
}
function stopReopen() { clearTimeout(reopenTimer) }
function onPopupChange(event) {
 visible.value = event.show
 if (event.show) { stopReopen(); return }
 if (props.open && !requestedClose) { requestedClose = true; emit('close') }
}
// 拖拽既然发生了面板必然可见：close() 幂等（重复调用仅重发 change 并重置 300ms 计时），
// 不允许用 open/requestedClose 早退——状态失配时早退会把面板连位移永久留在半空。
function dismissFromHandle() {
 requestedClose = true
 stopReopen()
 popup.value?.close()
 emit('close')
}
onBeforeUnmount(() => stopReopen())
defineExpose({ dismissFromHandle })
</script>
<script module="sheetGesture" lang="wxs">
var handleActive = false
var handleStartY = 0
var handleLastY = 0
var handleLastTime = 0
var handleVelocity = 0
var handleOffset = 0

function touchPoint(event) {
 var points = event.touches && event.touches.length ? event.touches : event.changedTouches
 return points && points.length ? points[0] : null
}

function setSheetStyle(ownerInstance, styles) {
 var target = ownerInstance.selectComponent('.sheet')
 if (target) target.setStyle(styles)
}

function handleStart(event, ownerInstance) {
 var point = touchPoint(event)
 if (!point || !event.touches || event.touches.length !== 1) { handleActive = false; return false }
 handleActive = true
 handleStartY = point.clientY
 handleLastY = handleStartY
 handleLastTime = event.timeStamp || 0
 handleVelocity = 0
 handleOffset = 0
 setSheetStyle(ownerInstance, { transition: 'none', transform: 'translateY(0px)' })
 return false
}

function handleMove(event, ownerInstance) {
 if (!handleActive || !event.touches || event.touches.length !== 1) return false
 var point = touchPoint(event)
 if (!point) return false
 var now = event.timeStamp || handleLastTime + 16
 handleVelocity = (point.clientY - handleLastY) / Math.max(1, now - handleLastTime)
 handleLastY = point.clientY
 handleLastTime = now
 var delta = point.clientY - handleStartY
 // 面板锚定屏底：只允许下拉 1:1 跟随，上拉保持原位，禁止负位移抬起底缘漏出背景。
 handleOffset = delta > 0 ? Math.round(delta) : 0
 setSheetStyle(ownerInstance, { transition: 'none', transform: 'translateY(' + handleOffset + 'px)' })
 return false
}

function clearHandle(ownerInstance, transition) {
 setSheetStyle(ownerInstance, { transition: transition, transform: 'translateY(0px)' })
 handleActive = false
 handleOffset = 0
 handleVelocity = 0
}

function resetHandle(ownerInstance) {
 clearHandle(ownerInstance, 'transform 300ms cubic-bezier(.32,.72,0,1)')
}

// 逻辑层每次打开前递增 surface-reset；由写入位移的同一 WXS 层同步清理 inline style。
function resetSurface(newValue, oldValue, ownerInstance) {
 if (newValue !== oldValue) clearHandle(ownerInstance, 'none')
}

function handleEnd(event, ownerInstance) {
 if (!handleActive) return false
 var threshold = event.currentTarget.dataset.threshold || 150
 var dismiss = handleOffset > threshold || (handleVelocity > 0.5 && handleOffset > 8)
 handleActive = false
 if (dismiss) {
  // 收起时保留松手位置的位移：uni-popup 的 slide-bottom 会从当前位置继续把面板带下屏。
  // 若先写回 translateY(0)，内层 300ms 回弹与外层下滑叠加成「先上窜再收起」的反向运动。
  // 下次打开前由 surface-reset 的 WXS observer 清零；禁止依赖 uni-popup 是否卸载槽位节点。
  ownerInstance.callMethod('dismissFromHandle')
 }
 else resetHandle(ownerInstance)
 return false
}

function handleCancel(event, ownerInstance) {
 if (handleActive) resetHandle(ownerInstance)
 return false
}

module.exports = {
 handleStart: handleStart,
 handleMove: handleMove,
 handleEnd: handleEnd,
 handleCancel: handleCancel,
 resetSurface: resetSurface
}
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.sheet { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); box-shadow:0 -8px 32px #16372814; }
.sheet.tall { height:78vh; }
.sheet-body { display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden; }
/* 只有横杆区域可拖拽；标题、筛选和搜索控件不再被拖拽手势吞掉。 */
.handle-zone { height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 120ms ease; }
.handle-zone--pressed { background:rgba(23,107,84,.04); }
.handle { width:36px; height:4px; background:#c4cbc6; border-radius:4px; transition:width 140ms cubic-bezier(.23,1,.32,1),background 140ms ease,transform 140ms ease; }
.handle-zone--pressed .handle { width:44px; background:#9eafa5; transform:scaleY(1.15); }
.header-slot { position:relative; z-index:2; border-bottom:1px solid #e3e8e4; overflow:visible; }
.header-top { display:flex; align-items:center; padding:2px 20px 8px; }
.header-copy { flex:1; min-width:0; }
.title-row { display:flex; align-items:baseline; gap:8px; min-width:0; }
.title { display:block; font-size:19px; font-weight:600; color:#24382d; flex-shrink:0; }
.meta { display:block; font-size:12px; color:#78877e; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.subtitle { display:block; font-size:12px; color:#78877e; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media(prefers-reduced-motion:reduce) { .sheet { transition:none; } }
</style>
