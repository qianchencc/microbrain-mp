<template>
 <view class="device-card" :class="[phase, { selected, ac: action.kind === 'ac' }]" hover-class="device-card--pressed" :hover-stay-time="60" :aria-label="action.deviceName" @tap="onToggle" @longpress="onLongPress">
  <view class="visual">
   <image v-if="art.src" class="product" :src="art.src" mode="aspectFit" :draggable="false" />
   <uni-icons v-else class="fallback" type="gear" size="34" color="#819087" />
   <text class="code">{{ art.code }} · {{ String(index + 1).padStart(2, '0') }}</text>
   <view v-if="!readonly" class="selection"><image v-if="selected" class="selection-check" src="/static/check.svg" /></view>
   <text v-if="action.kind !== 'access'" class="state">{{ powerLabel }}</text>
  </view>
  <view class="copy">
   <text class="type">{{ art.label }}</text><text class="name">{{ displayName }}</text>
   <view class="foot">
    <text v-if="location" class="location">{{ location }}</text>
    <view class="change"><text v-if="beforeKnown" class="from">{{ before }}</text><uni-icons v-if="beforeKnown" type="arrowthinright" size="12" color="#89968e" /><text class="to">{{ operation }}</text></view>
    <text :key="phase" class="outcome">{{ phaseLabel }}</text>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed } from 'vue'
import { deviceDisplayName, deviceLocationLabel, resolveDeviceArtwork } from '../device-art/catalog.js'
import { stateText } from '../device-card-state.js'
// 点选/长按全部交给原生手势：tap 负责选中（与滚动天然互斥），longpress 负责唤出配置面板
// （触发后框架保证不再派发 tap）。自制 touch 状态机的 catchtouchmove 会吞掉滚动、
// suppress 标记会误吞点击，禁止 reintroduce。
const props = defineProps({ action: Object, index: Number, selected: Boolean, readonly: Boolean, disabled: Boolean, currentState: { default: null }, phase: { default: 'pending' }, outcomeLabel: String, operation: String })
const emit = defineEmits(['toggle', 'configure'])
const art = computed(() => resolveDeviceArtwork(props.action))
const displayName = computed(() => deviceDisplayName(props.action.deviceName))
const location = computed(() => deviceLocationLabel(props.action))
const before = computed(() => stateText(props.action, Object.hasOwn(props.action, 'beforeState') ? props.action.beforeState : props.currentState))
const beforeKnown = computed(() => Boolean(before.value) && !before.value.includes('未知'))
const powerLabel = computed(() => props.currentState === true || props.currentState?.power === 'on' ? '已开启' : props.currentState === false || props.currentState?.power === 'off' ? '已关闭' : '状态未知')
const phaseLabel = computed(() => props.phase === 'failed' || props.action.kind === 'access' && props.phase === 'accepted' ? props.outcomeLabel : ({ complete: '已达到目标', accepted: '指令已受理', cancelled: '已取消', expired: '已过期', unselected: '未选择' }[props.phase] || ''))
const configurable = computed(() => !props.readonly && !props.disabled && props.phase === 'pending' && ['ac', 'access'].includes(props.action.kind))
function onToggle() { if (!props.readonly && !props.disabled) emit('toggle') }
function onLongPress() { if (configurable.value) emit('configure') }
</script>
<style scoped>
.device-card { white-space:normal; position:relative; width:119px; height:180px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; border-radius:6px; background:#f2f5f1; color:#17251f; box-shadow:0 9px 14px -12px #1e352b47; transition:box-shadow 180ms ease,opacity 180ms ease,transform 120ms ease; }
.device-card--pressed { transform:scale(.98); }
.device-card::after { content:''; position:absolute; inset:0; border-radius:6px; box-shadow:inset 0 0 0 1px #1a372b38; pointer-events:none; z-index:6; }.device-card.selected::after { box-shadow:inset 0 0 0 1.5px #1c755a; }
.visual { position:relative; height:72px; flex-shrink:0; overflow:hidden; background:linear-gradient(155deg,#d9ded9,#f4f3ed 48%,#cbd2cd); }.visual::before { content:''; position:absolute; inset:4px; border:1px solid #ffffff94; border-radius:3px; }.product { position:absolute; left:2%; top:2%; width:96%; height:96%; }.fallback { position:absolute; left:42px; top:19px; }.code { position:absolute; left:8px; top:7px; font-size:7px; font-weight:700; color:#53635a; }
.selection { position:absolute; top:6px; right:6px; width:17px; height:17px; border:1px solid #899b90; border-radius:4px; background:#fafbf9dd; display:flex; align-items:center; justify-content:center; }.selected .selection { background:#176b54; border-color:#176b54; }.selection-check { width:13px; height:13px; }.state { position:absolute; bottom:6px; left:8px; padding:3px 5px; border-radius:20px; background:#fff8e4dd; font-size:7px; color:#523b13; }
.copy { padding:6px 8px; flex:1; min-height:0; }.type,.name,.location,.outcome { display:block; }.type { color:#8e650f; font-size:8px; line-height:10px; }.name { font-size:11.5px; line-height:14px; font-weight:600; margin:5px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.foot { border-top:1px solid #1d3a2d1f; padding-top:5px; }.location { color:#5f6e66; font-size:9px; line-height:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }.change { display:flex; align-items:center; flex-wrap:wrap; gap:4px; font-size:9px; line-height:12px; }.from { color:#718078; }.to { color:#176e54; }.ac .to { flex:1; min-width:0; }.outcome { min-height:12px; font-size:9px; line-height:12px; color:#68766e; margin-top:3px; animation:arrive 180ms ease-out; }.complete .outcome { color:#176e54; }.cancelled .to { color:#7b837e; text-decoration:line-through; }
@keyframes arrive { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
@media(prefers-reduced-motion:reduce) { .outcome { animation:none; }.device-card { transition:none; } }
</style>
