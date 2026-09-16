<template>
 <uni-popup ref="popup" type="bottom" :is-mask-click="true" :safe-area="false" background-color="transparent" mask-background-color="rgba(20,35,28,.32)" @change="onPopupChange">
  <view class="sheet" :class="{ tall }">
   <view class="handle-zone" :data-threshold="dismissThreshold" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="sheetGesture.handleStart" @touchmove.stop.prevent="sheetGesture.handleMove" @touchend.stop="sheetGesture.handleEnd" @touchcancel.stop="sheetGesture.handleCancel"><view class="handle" /></view>
   <view class="header-top"><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text></view><text v-if="meta" class="meta">{{ meta }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><slot name="header-right" /></view>
   <view class="header-slot"><slot name="header" /></view>
   <view class="sheet-body"><slot /></view>
  </view>
 </uni-popup>
</template>
<script setup>
import UniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String, meta: String, tall: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const popup = ref(null)
const visible = ref(false)
const windowHeight = uni.getSystemInfoSync().windowHeight || 600
const dismissThreshold = Math.round(windowHeight * 0.78 * 0.25)
let reopenTimer
let requestedClose = false
watch(() => props.open, async value => {
 if (value) {
  requestedClose = false
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
 reopenTimer = setTimeout(() => { if (props.open && !visible.value) ensureOpen() }, 350)
}
function stopReopen() { clearTimeout(reopenTimer) }
function onPopupChange(event) {
 visible.value = event.show
 if (event.show) { stopReopen(); return }
 if (props.open && !requestedClose) { requestedClose = true; emit('close') }
}
function dismissFromHandle() {
 if (!props.open || requestedClose) return
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
 handleOffset = delta > 0 ? Math.round(delta) : Math.round(delta / 3)
 setSheetStyle(ownerInstance, { transition: 'none', transform: 'translateY(' + handleOffset + 'px)' })
 return false
}

function resetHandle(ownerInstance) {
 setSheetStyle(ownerInstance, { transition: 'transform 300ms cubic-bezier(.32,.72,0,1)', transform: 'translateY(0px)' })
 handleActive = false
 handleOffset = 0
 handleVelocity = 0
}

function handleEnd(event, ownerInstance) {
 if (!handleActive) return false
 var threshold = event.currentTarget.dataset.threshold || 150
 var dismiss = handleOffset > threshold || (handleVelocity > 0.5 && handleOffset > 8)
 handleActive = false
 if (dismiss) {
  // 清除跟随拖拽留下的位移，再交给 uni-popup 播放关闭动画。
  // 否则 popup 复用同一实例再次打开时，视觉位置与命中区域可能仍处于旧偏移。
  resetHandle(ownerInstance)
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
 handleCancel: handleCancel
}
</script>
<style scoped>
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
