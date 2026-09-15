<template>
 <view class="editor" :class="{ embedded }">
  <view v-if="siblings.length > 1" class="scope"><view><text>应用到全部同类设备</text><text class="muted">{{ all ? `草案中 ${targets.length} 台` : '仅当前设备' }}</text></view><switch :checked="all" :disabled="busy" color="#176b54" @change="all = $event.detail.value" /></view>
  <scroll-view scroll-y class="content">
   <image class="product" :src="isDoor ? '/static/device-art/access-sliding-door.png' : '/static/device-art/central-ac-cassette.png'" mode="aspectFit" />
   <text v-if="!isDoor" class="current">{{ currentSummary }}</text>
   <text class="caption">{{ isDoor ? '开门次数' : '目标温度' }}</text>
   <view v-if="isDoor || !closing" class="stepper"><button :disabled="busy || value <= min" aria-label="减少" @tap="step(-1)"><image class="step-icon" src="/static/minus.svg" /></button><view class="number"><input :value="value" type="digit" :disabled="busy" :placeholder="isDoor ? '多种' : '未知'" @input="edit(isDoor ? 'count' : 'temperature', Number($event.detail.value))" /><text>{{ isDoor ? '次' : '°C' }}</text></view><button :disabled="busy || value >= max" aria-label="增加" @tap="step(1)"><image class="step-icon" src="/static/plus.svg" /></button></view>
   <text v-else class="off">关闭电源，温度、模式与风速不作调整</text>
   <template v-if="isDoor"><text class="current">最多 5 次</text><view class="timeline"><view v-for="n in timelineCount" :key="n"><view class="dot" /><text>{{ n === 1 ? '立即' : `${(n-1)*5}秒后` }}</text></view></view><view class="field"><uni-icons type="clock" size="18" color="#75877a" /><text>发送间隔</text><text class="right">5 秒</text></view><text class="current">确认草案后自动执行全部次数</text></template>
   <template v-else>
    <slider v-if="!closing && min < max" :min="Math.round(min * 10)" :max="Math.round(max * 10)" :step="Math.round(temperatureStep * 10)" :value="Math.round((Number(value) || min) * 10)" :disabled="busy" activeColor="#4385c8" backgroundColor="#dce4df" :block-size="16" @change="edit('temperature', $event.detail.value / 10)" />
    <view class="field"><text>电源</text><text class="muted right">{{ status('power') }}</text><switch color="#176b54" :checked="setting('power') === 'on'" :disabled="busy" @change="edit('power', $event.detail.value ? 'on' : 'off')" /></view>
    <view class="field"><text class="field-label">模式</text><SlidingSegments class="options" tone="blue" :options="modeOptions" :model-value="setting('mode')" :disabled="busy || closing" @update:model-value="edit('mode', $event)" /></view>
    <view class="field"><text class="field-label">风速</text><SlidingSegments class="options" :options="fanOptions" :model-value="setting('fanSpeed')" :disabled="busy || closing" @update:model-value="edit('fanSpeed', $event)" /></view>
   </template>
   <text v-if="invalid" class="error">数值超出范围或精度不符合设备要求</text><text v-if="error" class="error">{{ error }}</text>
  </scroll-view>
  <view class="footer"><view v-if="!isDoor" class="comparison"><text>{{ currentSummary }}</text><uni-icons type="arrowthinright" size="16" color="#88958c" /><text>{{ targetSummary }}</text></view><view class="footer-row"><text class="muted">{{ changes.length ? `${changes.length} 台已修改` : '未修改' }}</text><button v-if="changes.length" class="undo" :disabled="busy" aria-label="撤销修改" @tap="fields = {}"><uni-icons type="refreshempty" size="18" color="#6b7e70" /></button><button class="save" :disabled="busy || !changes.length || invalid" :loading="busy" @tap="emit('save', changes)">保存到草案</button></view></view>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { acSummary, commonSetting, editSettings, effectiveSettings, settingStatus, modeLabels, fanLabels } from '../ac-draft.js'
import SlidingSegments from './SlidingSegments.vue'
defineOptions({ options: { virtualHost: true } })
const props = defineProps({ action: Object, actions: Array, states: Object, busy: Boolean, error: String, embedded: Boolean })
const emit = defineEmits(['save'])
const all = ref(false), fields = ref({})
const isDoor = computed(() => props.action.kind === 'access')
const siblings = computed(() => props.actions.filter(a => a.kind === props.action.kind))
const targets = computed(() => all.value ? siblings.value : [props.action])
const edits = computed(() => Object.entries(fields.value).reduce((out, [key, value]) => editSettings(out, targets.value, key, value, props.states), {}))
const changes = computed(() => Object.entries(edits.value).map(([actionId, patch]) => ({ actionId, patch })))
const min = computed(() => isDoor.value ? 1 : Math.max(...targets.value.map(a => a.parameters?.temperature.min ?? 16)))
const max = computed(() => isDoor.value ? 5 : Math.min(...targets.value.map(a => a.parameters?.temperature.max ?? 30)))
const temperatureStep = computed(() => Math.max(...targets.value.map(a => a.parameters?.temperature.step ?? .5)))
const value = computed(() => setting(isDoor.value ? 'count' : 'temperature'))
const closing = computed(() => targets.value.some(a => (edits.value[a.id]?.power ?? a.command.power) === 'off'))
const invalid = computed(() => changes.value.some(({ actionId, patch }) => {
 const number = isDoor.value ? patch.count : patch.temperature
 if (number === undefined) return false
 const a = targets.value.find(a => a.id === actionId), limits = a.parameters?.temperature
 return !Number.isFinite(number) || (isDoor.value ? !Number.isInteger(number) || number < 1 || number > 5 : !limits || number < limits.min || number > limits.max || Math.abs((number-limits.min)/limits.step - Math.round((number-limits.min)/limits.step)) > 1e-7)
}))
const modeIcons = { auto:'sparkles', cool:'snowflake', heat:'sun', dry:'droplets', fan:'wind' }
const modeOptions = computed(() => Object.entries(modeLabels).filter(([key]) => targets.value.every(a => a.parameters?.modes.includes(key))).map(([value,label]) => ({value,label,icon:modeIcons[value]})))
const fanOptions = computed(() => Object.entries(fanLabels).filter(([key]) => targets.value.every(a => a.parameters?.fanSpeeds.includes(key))).map(([value,label]) => ({value,label})))
function summarize(values) { return values.every(v => v === values[0]) ? values[0] : '多种设置' }
const currentSummary = computed(() => summarize(targets.value.map(a => acSummary(props.states[a.deviceId] || {}) || '状态未知')))
const targetSummary = computed(() => summarize(targets.value.map(a => { const target = effectiveSettings(a, props.states, edits.value); return acSummary(target.power === 'off' ? {power:'off'} : target) })))
const timelineCount = computed(() => Number.isInteger(value.value) && value.value >= 1 && value.value <= 5 ? value.value : 0)
function setting(field) { return commonSetting(targets.value, props.states, edits.value, field) }
function status(field) { return settingStatus(targets.value, props.states, edits.value, field) }
function edit(field, value) { if (!props.busy) fields.value = field === 'power' && value === 'off' ? {power:'off'} : {...fields.value,[field]:value} }
function step(direction) {
 // 对齐到步长网格（步长可能为 0.5 这类小数），再夹回设备量程
 const grid = 1 / temperatureStep.value
 const next = Math.round(((Number(value.value) || min.value) + direction * temperatureStep.value) * grid) / grid
 edit(isDoor.value ? 'count' : 'temperature', Math.max(min.value, Math.min(max.value, next)))
}
watch(() => props.action.id, () => { all.value = false; fields.value = {} })
</script>
<style scoped>
.step-icon { width:20px; height:20px; vertical-align:middle; }
.comparison text { word-break:keep-all; }
.editor { min-height:0; }.editor.embedded { height:0; flex:1; }.scope { flex-shrink:0; }
.editor { height:70vh; display:flex; flex-direction:column; }.scope { padding:12px 20px; display:flex; justify-content:space-between; align-items:center; font-size:13px; }.muted { display:block; color:#7b877f; font-size:11px; margin-top:4px; }.scope switch,.field switch { transform:scale(.8); transform-origin:right center; }.content { flex:1; height:0; padding:0 20px; box-sizing:border-box; }.product { display:block; width:240px; max-width:80%; height:120px; margin:0 auto; }.current,.caption { display:block; text-align:center; color:#7b877f; font-size:11px; margin:8px 0; }.stepper { display:flex; align-items:center; gap:8px; }.stepper button { width:40px; height:40px; line-height:40px; padding:0; margin:0; border-radius:50%; border:1px solid #dce5df; background:linear-gradient(#fff,#f3f5f3); box-shadow:0 2px 3px #20302714; flex-shrink:0; }.number { flex:1; display:flex; align-items:center; justify-content:center; gap:4px; min-width:0; }.number input { width:110px; height:64px; text-align:center; font-size:48px; color:#202b25; }.number>text { font-size:20px; color:#728277; margin-top:10px; }.field { display:flex; align-items:center; gap:8px; border:1px solid #e0e5e1; border-radius:8px; padding:7px 10px; min-height:48px; margin-top:6px; font-size:12px; }.field-label { width:30px; flex-shrink:0; }.options { flex:1; min-width:0; }.right { margin-left:auto; }.footer { flex-shrink:0; padding:12px 20px; border-top:1px solid #e3e8e4; }.footer-row { display:flex; align-items:center; gap:8px; }.save { margin:0 0 0 auto; background:#176b54; color:white; font-size:13px; border-radius:7px; padding:0 20px; line-height:42px; }.save[disabled] { background:#e6ece8; color:#87958b; }.undo { width:36px; height:36px; line-height:36px; padding:0; margin:0; background:transparent; }.comparison { display:flex; align-items:center; justify-content:center; gap:8px; font-size:11px; color:#748279; padding-bottom:10px; }.comparison text { flex:1; }.comparison text:last-child { color:#275741; }.comparison text:first-child { text-align:right; }.off { display:block; padding:24px 0; text-align:center; color:#718078; font-size:13px; }.error { display:block; color:#a2442f; font-size:12px; margin:12px 0; }.timeline { display:flex; justify-content:space-around; margin:20px 0; }.timeline>view { display:flex; flex-direction:column; align-items:center; gap:10px; font-size:11px; }.dot { width:10px; height:10px; border-radius:50%; background:#257458; }button::after { border:0; }button[disabled] { opacity:.5; }
@media(max-height:740px) { .product { height:105px; } }
</style>
