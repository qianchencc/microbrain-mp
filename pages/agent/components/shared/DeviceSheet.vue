<template>
 <NativeBackBoundary :active="open" :back="onNativeBack" />
 <view class="sheet-root" :class="{ 'sheet-root--open': open }">
  <view class="sheet-mask" :style="maskStyle" @tap.stop="dismissFromMask" @touchmove.stop.prevent="blockMaskMove" />
  <view class="sheet-motion" :style="motionStyle">
   <view class="sheet-surface" :class="{ tall, expanded, 'compact-header': compactHeader }">
    <view class="handle-zone" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend.stop="onTouchEnd" @touchcancel.stop="onTouchCancel"><view class="handle" /></view>
    <view class="header-top"><slot name="header-left" /><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text></view><text v-if="meta" class="meta">{{ meta }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><slot name="header-right" /><button class="sheet-close" :aria-label="'关闭' + (title || '面板')" hover-class="sheet-close--pressed" @tap="requestClose"><uni-icons type="closeempty" size="22" color="var(--agent-text-secondary)" /></button></view>
    <view class="header-slot"><slot name="header" /></view>
    <view class="sheet-body"><slot /></view>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import NativeBackBoundary from './NativeBackBoundary.vue'

const props = defineProps({ open: Boolean, openRequest: { type: Number, default: 0 }, title: String, subtitle: String, meta: String, tall: Boolean, expanded: Boolean, compactHeader: Boolean, busy: Boolean, beforeClose: Function, back: Function })
const emit = defineEmits(['close'])
let closingRequest = false
async function requestClose() {
 if (!props.open || closingRequest) return
 closingRequest = true
 let allowed = false
 try { allowed = !props.beforeClose || await props.beforeClose(); if (allowed) emit('close') }
 finally { closingRequest = false; if (!allowed && props.open) { dragY.value = 0; phase.value = 'settling'; settlePhase('open', settleDuration) } }
}
async function onNativeBack() {
 if (!props.open) return
 if (props.back) await props.back()
 else await requestClose()
}
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
  requestClose()
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
 requestClose()
}
function blockMaskMove() { return false }

onBeforeUnmount(clearPhaseTimer)
</script>
<style scoped lang="scss">
@import "../../styles/tokens";

/* Keep Agent components neutral to the host app's element-level font rules. */
view, text, input { font-size: inherit; line-height: inherit; }
.sheet-root { position:fixed; z-index:99; inset:0; pointer-events:none; }
.sheet-root--open { pointer-events:auto; }
.sheet-mask { position:absolute; z-index:0; inset:0; opacity:0; background:var(--agent-mask); pointer-events:none; will-change:opacity; }
.sheet-root--open .sheet-mask { opacity:1; pointer-events:auto; }
.sheet-motion { position:absolute; z-index:1; left:0; right:0; bottom:0; display:flex; flex-direction:column; pointer-events:none; will-change:transform; }
.sheet-root--open .sheet-motion { pointer-events:auto; }
.sheet-surface { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:var(--agent-surface); border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); box-shadow:0 -8px 32px rgba(var(--agent-shadow-rgb),.08); }
.sheet-surface.tall { height:78vh; }
.sheet-surface.expanded { height:90vh; }
.sheet-surface.compact-header .title { font-size:15px; }
.sheet-body { display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden; }
.handle-zone { height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 120ms ease; }
.handle-zone--pressed { background:rgba(var(--agent-shadow-rgb),.04); }
.handle { width:36px; height:4px; background:var(--agent-text-faint); border-radius:4px; transition:width 140ms cubic-bezier(.23,1,.32,1),background 140ms ease,transform 140ms ease; }
.handle-zone--pressed .handle { width:44px; background:var(--agent-text-faint); transform:scaleY(1.15); }
.header-slot { position:relative; z-index:2; overflow:visible; }
.header-top { display:flex; align-items:center; padding:2px 20px 8px; }
.sheet-close { width:44px; height:44px; flex-shrink:0; margin:0 -8px 0 4px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:14px; background:transparent; }.sheet-close::after { border:0; }.sheet-close--pressed { background:var(--agent-tint); }
.header-copy { flex:1; min-width:0; overflow:hidden; }
.title-row { display:flex; align-items:baseline; gap:$agent-space-small; min-width:0; }
.title { display:block; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:19px; font-weight:600; color:$agent-color-text-primary; }
.meta { display:block; font-size:$agent-font-size-compact; color:var(--agent-text-muted); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.subtitle { display:block; font-size:$agent-font-size-compact; color:var(--agent-text-muted); margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media(prefers-reduced-motion:reduce) { .sheet-mask,.sheet-motion { transition:none!important; } }
</style>
