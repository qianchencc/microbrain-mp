<template>
 <view class="sheet-root" :class="{ 'sheet-root--open': open }">
  <view class="sheet-mask" :style="maskStyle" @tap.stop="dismissFromMask" @touchmove.stop.prevent="blockMaskMove" />
  <view class="sheet-motion" :style="motionStyle">
   <view class="sheet-surface" :class="{ tall }">
    <view class="handle-zone" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"><view class="handle" /></view>
    <view class="header-top"><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text></view><text v-if="meta" class="meta">{{ meta }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><slot name="header-right" /></view>
    <view class="header-slot"><slot name="header" /></view>
    <view class="sheet-body"><slot /></view>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ open: Boolean, openRequest: { type: Number, default: 0 }, title: String, subtitle: String, meta: String, tall: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const open = computed(() => Boolean(props.open))
const windowHeight = uni.getSystemInfoSync().windowHeight || 600
const dismissThreshold = Math.round(windowHeight * 0.78 * 0.25)
const dragY = ref(0)
const dragging = ref(false)
const startY = ref(0)
const lastY = ref(0)
const lastTime = ref(0)
const velocity = ref(0)
const phase = ref(open.value ? 'entering' : 'closed')
const enterDuration = 300
const settleDuration = 220
const exitDuration = 220
let phaseTimer

function clearPhaseTimer() {
 if (phaseTimer) {
  clearTimeout(phaseTimer)
  phaseTimer = undefined
 }
}

function settlePhase(nextPhase, duration) {
 clearPhaseTimer()
 phaseTimer = setTimeout(() => {
  phase.value = nextPhase
  phaseTimer = undefined
 }, duration)
}

function resetForOpen() {
 clearPhaseTimer()
 dragY.value = 0
 dragging.value = false
 phase.value = 'entering'
 settlePhase('open', enterDuration)
}

function transformTransition() {
 if (dragging.value) return 'none'
 if (phase.value === 'entering') return `transform ${enterDuration}ms cubic-bezier(.22,1,.36,1)`
 if (phase.value === 'exiting') return `transform ${exitDuration}ms cubic-bezier(.4,0,.2,1)`
 if (phase.value === 'settling') return `transform ${settleDuration}ms cubic-bezier(.22,1,.36,1)`
 return 'none'
}

function maskTransition() {
 if (dragging.value) return 'none'
 if (phase.value === 'entering') return `opacity ${enterDuration - 40}ms cubic-bezier(.22,1,.36,1)`
 if (phase.value === 'exiting') return `opacity ${exitDuration - 40}ms cubic-bezier(.4,0,.2,1)`
 if (phase.value === 'settling') return `opacity ${settleDuration}ms cubic-bezier(.22,1,.36,1)`
 return 'none'
}

const motionStyle = computed(() => ({
 transform: open.value ? `translateY(${dragY.value}px)` : 'translateY(100%)',
 transition: transformTransition(),
}))
const maskStyle = computed(() => ({
 opacity: open.value ? Math.max(0, 1 - dragY.value / 500) : 0,
 transition: maskTransition(),
}))

watch(() => open.value, value => {
 clearPhaseTimer()
 if (value) {
  resetForOpen()
  return
 }
 dragging.value = false
 phase.value = 'exiting'
 settlePhase('closed', exitDuration)
})

watch(() => props.openRequest, () => {
 if (open.value) resetForOpen()
})

function point(event) {
 const touches = event.touches?.length ? event.touches : event.changedTouches
 return touches?.[0] ?? null
}

function onTouchStart(event) {
 const touch = point(event)
 if (!open.value || !touch || event.touches?.length !== 1) return
 dragging.value = true
 phase.value = 'dragging'
 startY.value = touch.clientY
 lastY.value = touch.clientY
 lastTime.value = event.timeStamp || 0
 velocity.value = 0
 dragY.value = 0
}

function onTouchMove(event) {
 const touch = point(event)
 if (!dragging.value || !touch || event.touches?.length !== 1) return
 const now = event.timeStamp || lastTime.value + 16
 velocity.value = (touch.clientY - lastY.value) / Math.max(1, now - lastTime.value)
 lastY.value = touch.clientY
 lastTime.value = now
 dragY.value = Math.max(0, Math.round(touch.clientY - startY.value))
}

function finishDrag() {
 if (!dragging.value) return
 const dismiss = dragY.value > dismissThreshold || (velocity.value > 0.5 && dragY.value > 8)
 dragging.value = false
 if (dismiss) {
  phase.value = 'exiting'
  emit('close')
  return
 }
 phase.value = 'settling'
 dragY.value = 0
 settlePhase('open', settleDuration)
}

function onTouchEnd() { finishDrag() }
function onTouchCancel() {
 if (!dragging.value) return
 dragging.value = false
 phase.value = 'settling'
 dragY.value = 0
 settlePhase('open', settleDuration)
}
function dismissFromMask() {
 if (!open.value) return
 phase.value = 'exiting'
 emit('close')
}
function blockMaskMove() { return false }

onBeforeUnmount(clearPhaseTimer)
</script>
<style scoped>

/* Keep Agent components neutral to the host app's element-level font rules. */
view, text, input { font-size: inherit; line-height: inherit; }
.sheet-root { position:fixed; z-index:99; inset:0; pointer-events:none; }
.sheet-root--open { pointer-events:auto; }
.sheet-mask { position:absolute; z-index:0; inset:0; opacity:0; background:rgba(20,35,28,.32); pointer-events:none; will-change:opacity; }
.sheet-root--open .sheet-mask { opacity:1; pointer-events:auto; }
.sheet-motion { position:absolute; z-index:1; left:0; right:0; bottom:0; display:flex; flex-direction:column; pointer-events:none; will-change:transform; }
.sheet-root--open .sheet-motion { pointer-events:auto; }
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
@media(prefers-reduced-motion:reduce) { .sheet-mask,.sheet-motion { transition:none!important; } }
</style>
