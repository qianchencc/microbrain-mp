<template>
 <view class="device-card" :class="[phase, { selected, ac: action.kind === 'ac' }]" hover-class="device-card--pressed" :hover-stay-time="60" :aria-label="action.deviceName" @tap="onToggle" @touchstart="holdStart" @touchmove="holdMove" @touchend="holdEnd" @touchcancel="holdCancel" @longpress="completeHold">
  <view v-if="holding && progress >= 90" class="hold-ring"><view class="ring-fill" :style="{ background: `conic-gradient(#176b54 ${progress}deg, #dce5df 0)` }" /></view>
  <view class="visual">
   <image v-if="art.src" class="product" :src="art.src" mode="aspectFit" :draggable="false" />
   <uni-icons v-else class="fallback" type="gear" size="34" color="#819087" />
   <text class="code">{{ art.code }} · {{ String(index + 1).padStart(2, '0') }}</text>
   <view v-if="!readonly" class="selection"><image v-if="selected" class="selection-check" src="/static/check.svg" /></view>
   <text v-if="action.kind !== 'access'" class="state">{{ powerLabel }}</text>
  </view>
  <view class="copy">
   <text class="type"><text v-for="(part, partIndex) in highlightParts(art.label)" :key="'type-' + partIndex" :class="{ match: part.match }">{{ part.text }}</text></text><text class="name"><text v-for="(part, partIndex) in highlightParts(displayName)" :key="'name-' + partIndex" :class="{ match: part.match }">{{ part.text }}</text></text>
   <view class="foot">
    <text v-if="location" class="location"><text v-for="(part, partIndex) in highlightParts(location)" :key="'location-' + partIndex" :class="{ match: part.match }">{{ part.text }}</text></text>
    <view class="change"><text v-if="beforeKnown" class="from">{{ before }}</text><text class="to"><text class="arrow">→</text> {{ operation }}</text></view>
    <text :key="phase" class="outcome">{{ phaseLabel }}</text>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { deviceDisplayName, deviceLocationLabel, resolveDeviceArtwork } from '../device-art/catalog.js'
import { cardConfigurable, reduceCardHold, stateText, tapBlockHint } from '../device-card-state.js'
// 点选走原生 @tap；touch 流驱动长按进度与滚动取消，原生 longpress 兜底提交意图，监听一律不带 .stop。
// committed 须等 terminal touch 进入 released 后才 emit configure，避免手指仍按住旧卡片时挂载 popup；正常抬手的随行 tap 用一次性 holdDone 屏蔽。
// 位移超 14px 视为滚动并取消；禁止 reintroduce catch 触摸事件或 suppress 时间戳（会吞滚动/误吞点击）。
const props = defineProps({ action: Object, index: Number, selected: Boolean, readonly: Boolean, disabled: Boolean, currentState: { default: null }, phase: { default: 'pending' }, outcomeLabel: String, operation: String, highlight: { type: String, default: '' } })
const emit = defineEmits(['toggle', 'configure'])
const art = computed(() => resolveDeviceArtwork(props.action))
const displayName = computed(() => deviceDisplayName(props.action.deviceName))
const location = computed(() => deviceLocationLabel(props.action))
const before = computed(() => stateText(props.action, props.phase === 'pending' ? props.currentState : props.action.beforeState))
const beforeKnown = computed(() => Boolean(before.value) && !before.value.includes('未知'))
const powerLabel = computed(() => props.currentState === true || props.currentState?.power === 'on' ? '已开启' : props.currentState === false || props.currentState?.power === 'off' ? '已关闭' : '状态未知')
const phaseLabel = computed(() => props.phase === 'failed' || props.action.kind === 'access' && props.phase === 'accepted' ? props.outcomeLabel : ({ complete: '已达到目标', accepted: '指令已受理', cancelled: '已取消', expired: '已过期', unselected: '未选择' }[props.phase] || ''))
const configurable = computed(() => cardConfigurable(props.action, props.phase, { readonly: props.readonly, disabled: props.disabled }))

function highlightParts(value) {
 const text = String(value || '')
 const query = props.highlight.trim()
 if (!query) return [{ text, match: false }]
 const source = text.toLocaleLowerCase()
 const target = query.toLocaleLowerCase()
 const parts = []
 let cursor = 0, index
 while ((index = source.indexOf(target, cursor)) >= 0) {
  if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false })
  parts.push({ text: text.slice(index, index + query.length), match: true })
  cursor = index + query.length
 }
 if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
 return parts.length ? parts : [{ text, match: false }]
}

// 微信开发者工具与真实手机都会有少量触点漂移；360ms 对齐微信原生 longpress，同时不把普通点按变成长按。
const HOLD_TOTAL = 360
const HOLD_MOVE_TOLERANCE = 14
const holding = ref(false), progress = ref(0)
let holdTimer = null, startTouch = null, holdDone = false, holdState = 'idle'

function holdStart(e) {
 holdDone = false
 if (!configurable.value || e.touches.length !== 1) return
 holdState = reduceCardHold('idle', 'start')
 startTouch = { id: e.touches[0].identifier, x: e.touches[0].clientX, y: e.touches[0].clientY }
 holding.value = true
 progress.value = 0
 const started = Date.now()
 holdTimer = setInterval(() => {
  const ratio = Math.min(1, (Date.now() - started) / HOLD_TOTAL)
  progress.value = Math.round(ratio * 360)
  if (ratio >= 1) completeHold()
 }, 24)
}
function completeHold(e) {
 const nativeLongPress = e?.type === 'longpress'
 if (!configurable.value || !nativeLongPress && !startTouch || holdState === 'committed' || holdState === 'cancelled') return
 holdState = reduceCardHold(holdState, 'complete')
 clearInterval(holdTimer)
 holdTimer = null
 holdDone = true
 startTouch = null
 holding.value = true
 progress.value = 360
}
function holdMove(e) {
 if (!startTouch || holdState === 'committed') return
 const touch = e.touches.find(item => item.identifier === startTouch.id)
 if (touch && Math.hypot(touch.clientX - startTouch.x, touch.clientY - startTouch.y) > HOLD_MOVE_TOLERANCE) holdCancel()
}
function releaseCommitted(event) {
 holdState = reduceCardHold(holdState, event)
 holding.value = false
 progress.value = 0
 if (holdState !== 'released') return
 holdDone = event === 'end'
 holdState = 'idle'
 emit('configure')
}
function holdEnd(e) {
 if (holdState === 'committed') { releaseCommitted('end'); return }
 if (!startTouch) return
 if (e.changedTouches.some(item => item.identifier === startTouch.id)) stopHold('end')
}
function holdCancel() {
 if (holdState === 'committed') { releaseCommitted('cancel'); return }
 stopHold('cancel')
 holdDone = false
}
function stopHold(event = 'cancel') { clearInterval(holdTimer); holdTimer = null; holdState = reduceCardHold(holdState, event); startTouch = null; holding.value = false; progress.value = 0 }
function onToggle() {
 if (holdDone) { holdDone = false; holdState = 'idle'; return }
 if (props.readonly || props.disabled) {
  const hint = tapBlockHint(props.phase, { readonly: props.readonly, disabled: props.disabled })
  if (hint) uni.showToast({ title: hint, icon: 'none' })
  return
 }
 emit('toggle')
}
onBeforeUnmount(stopHold)
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.device-card { white-space:normal; position:relative; width:119px; height:180px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; border-radius:6px; background:#f2f5f1; color:#17251f; box-shadow:0 9px 14px -12px #1e352b47; transition:box-shadow 180ms ease,opacity 180ms ease,transform 120ms ease; }
/* 浏览网格只计算列数与轨道宽度，卡片本体在所有表面保持 119×180px。 */
.device-card--pressed { transform:scale(.98); }
.hold-ring { position:absolute; left:calc(50% - 16px); top:8px; width:32px; height:32px; border-radius:50%; background:#ffffffee; z-index:8; display:flex; align-items:center; justify-content:center; }.ring-fill { width:24px; height:24px; border-radius:50%; position:relative; transform:rotate(-90deg); }.ring-fill::after { content:''; position:absolute; inset:3px; background:white; border-radius:50%; }
.device-card::after { content:''; position:absolute; inset:0; border-radius:6px; box-shadow:inset 0 0 0 1px #1a372b38; pointer-events:none; z-index:6; }.device-card.selected::after { box-shadow:inset 0 0 0 1.5px #1c755a; }
.visual { position:relative; height:72px; flex-shrink:0; overflow:hidden; background:linear-gradient(155deg,#d9ded9,#f4f3ed 48%,#cbd2cd); }.visual::before { content:''; position:absolute; inset:4px; border:1px solid #ffffff94; border-radius:3px; }.product { position:absolute; left:2%; top:2%; width:96%; height:96%; }.fallback { position:absolute; left:42px; top:19px; }.code { position:absolute; left:8px; top:7px; font-size:7px; font-weight:700; color:#53635a; }
.selection { position:absolute; top:6px; right:6px; width:17px; height:17px; border:1px solid #899b90; border-radius:4px; background:#fafbf9dd; display:flex; align-items:center; justify-content:center; }.selected .selection { background:#176b54; border-color:#176b54; }.selection-check { width:13px; height:13px; }.state { position:absolute; bottom:6px; left:8px; padding:3px 5px; border-radius:20px; background:#fff8e4dd; font-size:7px; color:#523b13; }
.copy { padding:6px 8px; flex:1; min-height:0; }.type,.name,.location,.outcome { display:block; }.type { color:#8e650f; font-size:8px; line-height:10px; }.name { font-size:11.5px; line-height:14px; font-weight:600; margin:5px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.foot { border-top:1px solid #1d3a2d1f; padding-top:5px; }.location { color:#5f6e66; font-size:9px; line-height:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }/* before→after 纵向两行制：acSummary 复合串在 103px 内宽里单行不可能容纳两段，
   每段独占一行 + nowrap+ellipsis（与 name/location 同一纪律），最坏退化为行尾省略，
   禁止横向 flex-wrap 硬排——flex item 缩到内容宽以下时 CJK 逐字竖排（2026-09-17 根因）。 */
.change { font-size:9px; line-height:12px; }.from,.to { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.from { color:#718078; }.to { color:#176e54; margin-top:1px; }.to .arrow { color:#89968e; }.outcome { min-height:12px; font-size:9px; line-height:12px; color:#68766e; margin-top:3px; animation:arrive 180ms ease-out; }.complete .outcome { color:#176e54; }.cancelled .to { color:#7b837e; text-decoration:line-through; }
.match { border-radius:2px; background:#f6dda480; box-shadow:0 0 0 1px #dca93a24; color:inherit; }
@keyframes arrive { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
@media(prefers-reduced-motion:reduce) { .outcome { animation:none; }.device-card { transition:none; } }
</style>
