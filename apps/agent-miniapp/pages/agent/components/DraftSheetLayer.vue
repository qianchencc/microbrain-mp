<template>
 <DeviceSheet :open="open" :title="browser ? '全部设备' : current?.kind === 'ac' ? '空调调节' : '开门设置'" :meta="browser ? draft.actions.length + ' 台设备' : ''" :subtitle="browser ? '' : current?.deviceName" :tall="browser" :busy="busy" @close="emit('close')">
  <template v-if="browser" #header>
   <view class="controls" :class="{ collapsed: page !== 0 }">
    <view class="layer" :class="{ active: !searching }">
     <view class="modes"><view v-for="(mode, index) in groupModes" :key="mode.by" class="mode" :class="{ active: groupIndex === index }" hover-class="mode--pressed" :hover-stay-time="60" @tap="groupIndex = index">{{ mode.label }}</view></view>
     <view class="fill" />
     <button class="search-toggle" aria-label="搜索设备" hover-class="search-toggle--pressed" :hover-stay-time="60" @tap="searching = true"><image class="search-toggle-icon" src="/static/search.svg" /></button>
     <button class="quiet" :disabled="busy || !pending" @tap="emit('select', selected.length === draft.actions.length ? [] : draft.actions.map(a => a.id))">{{ selected.length === draft.actions.length ? '取消全选' : '全选' }}</button>
    </view>
    <view class="layer" :class="{ active: searching }">
     <view class="search-field"><image class="search-field-icon" src="/static/search.svg" /><input v-model="search" class="search-input" placeholder="搜索设备" placeholder-style="color:#8a978f" confirm-type="search" :focus="searching" :adjust-position="false" /></view>
     <button class="quiet cancel" @tap="searching = false">取消</button>
    </view>
   </view>
  </template>
  <swiper v-if="browser" class="pages" :current="page" :duration="250" :disable-touch="!current || busy" @change="changePage">
   <swiper-item><view class="browser">
    <view v-if="staleText" class="stale-note"><text>{{ staleText }}</text><button v-if="draft.status === 'EXPIRED'" class="stale-revalidate" :disabled="busy" hover-class="stale-revalidate--pressed" @tap="emit('revalidate')">重新核验</button></view>
    <view class="device-scroll-shell"><scroll-view scroll-y enhanced :show-scrollbar="false" class="device-list"><view v-for="group in groups" :key="group.key" class="group"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="!pending" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text></scroll-view></view>
    <view class="browser-footer"><button class="primary" :disabled="busy || !pending || !selected.length" hover-class="primary--pressed" @tap="emit('close'); emit('confirm')">确认草案{{ selected.length ? ' · ' + selected.length : '' }}</button></view>
   </view></swiper-item>
   <swiper-item><view class="editor-page">
    <button v-if="current" class="back" hover-class="back--pressed" @tap="page = 0"><image class="back-icon" src="/static/back.svg" /><text>{{ current.deviceName }}</text></button>
    <view v-if="current && !pending" class="stale-note"><text>{{ staleText }}</text><button v-if="draft.status === 'EXPIRED'" class="stale-revalidate" :disabled="busy" hover-class="stale-revalidate--pressed" @tap="emit('revalidate')">重新核验</button></view>
    <ParameterEditor v-if="current && pending" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
   </view></swiper-item>
  </swiper>
  <ParameterEditor v-else-if="current" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
 </DeviceSheet>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { readDeviceStates, updateParameters } from '@/apis/agent'
import { operationLabel } from '../ac-draft.js'
import { receiptPhase } from '../device-card-state.js'
import { createDraftGroups } from '../action-draft-presentation.js'
import { receiptText } from '../conversation.mjs'
import DeviceActionCard from './DeviceActionCard.vue'
import DeviceSheet from './DeviceSheet.vue'
import ParameterEditor from './ParameterEditor.vue'
const props = defineProps({ draft: { type: Object, default: null }, result: { type: Object, default: null }, browser: Boolean, currentActionId: { type: String, default: '' }, busy: Boolean })
const emit = defineEmits(['close', 'select', 'confirm', 'updated', 'editing', 'revalidate'])
const states = ref({}), page = ref(0), search = ref(''), groupIndex = ref(0), parameterError = ref(''), searching = ref(false)
const currentId = ref('')
const groupModes = [{ label: '区域', by: 'location' }, { label: '类型', by: 'kind' }, { label: '选择', by: 'selection' }]
const open = computed(() => Boolean(props.draft))
const pending = computed(() => props.draft?.status === 'PENDING_CONFIRMATION')
const staleText = computed(() => ({ EXPIRED: '核验已过期，未执行。重新核验后可继续调整。', CANCELLED: '操作已取消，未执行。发送新指令可重新下达。' }[props.draft?.status] || ''))
const selected = computed(() => props.draft?.selectedActionIds || [])
const current = computed(() => props.draft?.actions.find(action => action.id === currentId.value) ?? null)
const groups = computed(() => props.draft ? createDraftGroups(props.draft.actions.filter(action => (action.deviceName + action.location).includes(search.value.trim())), selected.value, { groupBy: groupModes[groupIndex.value].by }) : [])
watch(() => props.currentActionId, value => { currentId.value = value }, { immediate: true })
watch(() => props.draft?.draftId, () => { page.value = 0; search.value = ''; groupIndex.value = 0; parameterError.value = ''; searching.value = false })
watch(open, value => { if (value) refresh() })
function toggle(id) { if (!pending.value || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id]) }
function configure(action) { if (props.busy || !pending.value) return; currentId.value = action.id; parameterError.value = ''; if (props.browser) page.value = 1 }
function changePage(event) { if (event.detail.source === 'touch') page.value = event.detail.current }
function receipt(action) { return props.result?.receipts?.find(item => item.actionId === action.id) }
function outcome(action) { return receiptText(receipt(action)) }
function phase(action) {
 if (props.result) return receiptPhase(action, receipt(action)?.outcome ?? (selected.value.includes(action.id) ? props.result.status : 'UNSELECTED'), states.value[action.deviceId])
 return props.draft.status === 'CANCELLED' ? 'cancelled' : props.draft.status === 'EXPIRED' ? 'expired' : 'pending'
}
async function refresh() {
 if (!props.draft) return
 try { const snapshot = await readDeviceStates(props.draft.draftId); states.value = snapshot.states }
 catch { states.value = {} }
}
async function save(changes) {
 if (props.busy || !pending.value) return
 emit('editing', true)
 parameterError.value = ''
 try {
  const updated = await updateParameters(props.draft.draftId, props.draft.revision, changes)
  emit('updated', updated)
  if (props.browser) page.value = 0
  else emit('close')
 }
 catch (error) { parameterError.value = error.message }
 finally { emit('editing', false) }
}
</script>
<style scoped>
.pages { height:100%; }.editor-page { display:flex; flex-direction:column; height:100%; overflow:hidden; }.browser { display:flex; flex-direction:column; height:100%; }.device-scroll-shell { flex:1; min-height:0; overflow:hidden; }.stale-note { display:flex; align-items:center; gap:8px; margin:12px 20px 0; padding:9px 12px; border-radius:8px; background:#fbf3e2; color:#7a5a16; font-size:12px; line-height:1.5; flex-shrink:0; }.stale-note text { flex:1; min-width:0; }.stale-revalidate { min-height:32px; margin:0; padding:0 12px; border-radius:7px; background:#176b54; color:white; font-size:12px; line-height:30px; white-space:nowrap; flex-shrink:0; }.stale-revalidate--pressed { transform:scale(.97); opacity:.85; }.stale-revalidate[disabled] { opacity:.4; }.stale-revalidate::after { border:0; }.controls { position:relative; height:58px; flex-shrink:0; transition:height 200ms cubic-bezier(.2,0,0,1),opacity 200ms cubic-bezier(.2,0,0,1); }.controls.collapsed { height:0; opacity:0; overflow:hidden; }.layer { position:absolute; left:20px; right:20px; top:5px; height:48px; display:flex; align-items:center; gap:8px; opacity:0; transform:scale(.98); transition:opacity 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1); pointer-events:none; }.layer.active { opacity:1; transform:scale(1); pointer-events:auto; }.modes { display:flex; gap:6px; }.mode { height:36px; line-height:36px; padding:0 14px; font-size:13px; color:#6b7771; border-radius:18px; transition:background-color 150ms ease-out,color 150ms ease-out,transform 120ms ease-out; }.mode.active { background:#e2eee8; color:#176b54; font-weight:500; }.mode--pressed { transform:scale(.96); }.fill { flex:1; }.search-toggle { width:40px; height:40px; margin:0; padding:0; display:flex; align-items:center; justify-content:center; background:#eef2ef; border-radius:20px; flex-shrink:0; transition:transform 120ms ease-out; }.search-toggle--pressed { transform:scale(.94); }.search-field { flex:1; height:40px; display:flex; align-items:center; gap:8px; padding:0 14px; background:#eef2ef; border-radius:20px; }.search-input { flex:1; height:100%; font-size:13px; color:#24382d; }.quiet.cancel { color:#6b7771; flex-shrink:0; }.device-list { height:100%; box-sizing:border-box; padding:0 20px; }.group { margin-bottom:20px; }.group-title { display:block; font-size:12px; font-weight:500; color:#5d6963; margin-bottom:12px; }.grid { display:flex; flex-wrap:wrap; gap:12px; }.grid :deep(.device-card) { width:calc(50% - 6px); }.browser-footer { display:flex; padding:12px 20px; border-top:1px solid #e3e8e4; }.back { display:flex; align-items:center; gap:6px; margin:0; padding:0 20px; font-size:12px; line-height:40px; background:transparent; color:#728178; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.back--pressed { transform:scale(.97); opacity:.7; }.back-icon { display:block; width:14px; height:14px; }.note { display:block; font-size:13px; color:#5d6963; margin:12px 20px; }.quiet { min-height:44px; padding:0 4px; margin:0; background:transparent; color:#176b54; font-size:13px; line-height:44px; }.primary { flex:1; display:flex; align-items:center; justify-content:center; min-height:44px; margin:0; padding:0 14px; font-size:14px; font-weight:500; line-height:44px; background:#176b54; color:white; border-radius:7px; transition:transform 120ms ease-out,opacity 150ms ease; }.primary--pressed { transform:scale(.98); opacity:.92; }.primary[disabled] { opacity:.55; }button::after { border:0; }@media(prefers-reduced-motion:reduce){.mode,.primary,.search-toggle{transition:none;}.controls{transition:none;}.layer{transform:none;transition:opacity 150ms ease;}}
</style>
