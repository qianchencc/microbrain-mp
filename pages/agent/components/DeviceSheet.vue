<template>
 <view class="sheet-root" :class="{ 'sheet-root--open': open }">
  <view class="sheet-mask" @tap.stop="dismissFromMask" @touchmove.stop.prevent="sheetGesture.blockMaskMove" />
  <view class="sheet-motion">
   <view class="sheet-surface" :class="{ tall }" :surface-reset="surfaceReset" :change:surface-reset="sheetGesture.resetSurface">
    <view class="handle-zone" :data-threshold="dismissThreshold" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="sheetGesture.handleStart" @touchmove.stop.prevent="sheetGesture.handleMove" @touchend.stop="sheetGesture.handleEnd" @touchcancel.stop="sheetGesture.handleCancel"><view class="handle" /></view>
    <view class="header-top"><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text></view><text v-if="meta" class="meta">{{ meta }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><slot name="header-right" /></view>
    <view class="header-slot"><slot name="header" /></view>
    <view class="sheet-body"><slot /></view>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, openRequest: { type: Number, default: 0 }, title: String, subtitle: String, meta: String, tall: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const open = computed(() => Boolean(props.open))
// WXS writes the drag transform directly to the inner surface. Keep the surface mounted so a
// close/reopen reverses the same outer transition instead of racing a popup teardown timer.
const surfaceReset = ref(0)
const windowHeight = uni.getSystemInfoSync().windowHeight || 600
const dismissThreshold = Math.round(windowHeight * 0.78 * 0.25)
watch(() => [props.open, props.openRequest], ([value]) => {
 if (value) surfaceReset.value++
}, { immediate: true })
function dismissFromMask() {
 if (props.open) emit('close')
}
function dismissFromHandle() {
 if (props.open) emit('close')
}
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
 var target = ownerInstance.selectComponent('.sheet-surface')
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
 // The outer motion layer owns enter/exit. The inner surface follows the finger only downward.
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

function resetSurface(newValue, oldValue, ownerInstance) {
 if (newValue !== oldValue) clearHandle(ownerInstance, 'none')
}

function handleEnd(event, ownerInstance) {
 if (!handleActive) return false
 var threshold = event.currentTarget.dataset.threshold || 150
 var dismiss = handleOffset > threshold || (handleVelocity > 0.5 && handleOffset > 8)
 handleActive = false
 if (dismiss) ownerInstance.callMethod('dismissFromHandle')
 else resetHandle(ownerInstance)
 return false
}

function handleCancel(event, ownerInstance) {
 if (handleActive) resetHandle(ownerInstance)
 return false
}

function blockMaskMove() {
 return false
}

module.exports = {
 handleStart: handleStart,
 handleMove: handleMove,
 handleEnd: handleEnd,
 handleCancel: handleCancel,
 blockMaskMove: blockMaskMove,
 resetSurface: resetSurface
}
</script>
<style scoped>

/* Keep Agent components neutral to the host app's element-level font rules. */
view, text, input { font-size: inherit; line-height: inherit; }
.sheet-root { position:fixed; z-index:99; inset:0; pointer-events:none; }
.sheet-root--open { pointer-events:auto; }
.sheet-mask { position:absolute; z-index:0; inset:0; opacity:0; background:rgba(20,35,28,.32); pointer-events:none; transition:opacity 300ms ease; }
.sheet-root--open .sheet-mask { opacity:1; pointer-events:auto; }
.sheet-motion { position:absolute; z-index:1; left:0; right:0; bottom:0; display:flex; flex-direction:column; transform:translateY(100%); pointer-events:none; transition:transform 300ms cubic-bezier(.32,.72,0,1); }
.sheet-root--open .sheet-motion { transform:translateY(0); pointer-events:auto; }
.sheet-surface { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); box-shadow:0 -8px 32px #16372814; }
.sheet-surface.tall { height:78vh; }
.sheet-body { display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden; }
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
@media(prefers-reduced-motion:reduce) { .sheet-mask,.sheet-motion { transition:none; } }
</style>
