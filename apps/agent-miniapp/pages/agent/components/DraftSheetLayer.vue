<template>
 <DeviceSheet :open="open" :title="browser ? '全部设备' : current?.kind === 'ac' ? '空调调节' : '开门设置'" :meta="browser ? draft.actions.length + ' 台设备' : ''" :subtitle="browser ? '' : current?.deviceName" :tall="browser" :busy="busy" @close="emit('close')">
  <template v-if="browser" #header>
   <view v-if="page === 0" class="controls" @tap="groupOpen = false">
    <view class="group-picker-wrap" @tap.stop>
     <button class="group-picker" :class="{ open: groupOpen }" @tap="groupOpen = !groupOpen"><text>{{ groupModes[groupIndex].label }}</text><view class="chevron" /></button>
     <view v-if="groupOpen" class="group-menu">
      <button v-for="(mode, index) in groupModes" :key="mode.by" class="group-option" :class="{ active: index === groupIndex }" @tap="selectGroup(index)"><text>{{ mode.label }}</text><text v-if="index === groupIndex" class="group-check">✓</text></button>
     </view>
    </view>
    <button class="search-toggle" aria-label="搜索设备" hover-class="search-toggle--pressed" :hover-stay-time="60" @tap="page = 1"><image class="search-toggle-icon" src="/static/search.svg" /></button>
    <button class="header-select-all" :disabled="busy || !pending" hover-class="header-select-all--pressed" @tap="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
   </view>
  </template>
  <view v-if="browser" class="pages">
   <view class="browser-page-frame" :class="{ search: page === 1 }">
   <view class="browser-page list-page browser">
    <view class="device-scroll-shell"><scroll-view scroll-y class="device-list"><view v-for="group in groups" :key="group.key" class="group"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="!pending" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text></scroll-view></view>
    <view class="browser-footer"><button class="primary" :disabled="busy || !pending || !selected.length" hover-class="primary--pressed" @tap="emit('close'); emit('confirm')">确认草案{{ selected.length ? ' · ' + selected.length : '' }}</button></view>
   </view>
   <view class="browser-page search-page">
    <button class="back" hover-class="back--pressed" @tap="page = 0"><image class="back-icon" src="/static/back.svg" /><text>返回设备</text></button>
    <view class="search-row"><image class="search-field-icon" src="/static/search.svg" /><input v-model="search" class="search-input" placeholder="搜索设备名称或位置" placeholder-style="color:#8a978f" confirm-type="search" :focus="page === 1" :adjust-position="false" /></view>
    <view class="search-scroll-shell"><scroll-view scroll-y class="device-list"><view v-for="group in groups" :key="group.key" class="group"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="!pending" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text></scroll-view></view>
   </view>
   </view>
   <view v-show="page === 2" class="editor-page">
    <button v-if="current" class="back" hover-class="back--pressed" @tap="page = editorBack"><image class="back-icon" src="/static/back.svg" /><text>{{ current.deviceName }}</text></button>
    <view v-if="current && !pending" class="stale-note"><text>{{ staleText }}</text><button v-if="draft.status === 'EXPIRED'" class="stale-revalidate" :disabled="busy" hover-class="stale-revalidate--pressed" @tap="emit('revalidate')">重新核验</button></view>
    <ParameterEditor v-if="current && pending" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
   </view>
  </view>
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
const states = ref({}), page = ref(0), search = ref(''), groupIndex = ref(0), groupOpen = ref(false), parameterError = ref('')
const currentId = ref(''), editorBack = ref(0)
const groupModes = [{ label: '区域', by: 'location' }, { label: '类型', by: 'kind' }, { label: '选择', by: 'selection' }]
function selectGroup(index) { groupIndex.value = index; groupOpen.value = false }
const open = computed(() => Boolean(props.draft))
const pending = computed(() => props.draft?.status === 'PENDING_CONFIRMATION')
const staleText = computed(() => ({ EXPIRED: '核验已过期，未执行。重新核验后可继续调整。', CANCELLED: '操作已取消，未执行。发送新指令可重新下达。' }[props.draft?.status] || ''))
const selected = computed(() => props.draft?.selectedActionIds || [])
const allSelected = computed(() => Boolean(props.draft?.actions.length) && selected.value.length === props.draft.actions.length)
const current = computed(() => props.draft?.actions.find(action => action.id === currentId.value) ?? null)
const groups = computed(() => props.draft ? createDraftGroups(props.draft.actions.filter(action => (action.deviceName + action.location).includes(search.value.trim())), selected.value, { groupBy: groupModes[groupIndex.value].by }) : [])
watch(() => props.currentActionId, value => { currentId.value = value }, { immediate: true })
watch(() => props.draft?.draftId, () => { page.value = 0; search.value = ''; groupIndex.value = 0; groupOpen.value = false; parameterError.value = '' })
// 面板内三页导航：0 全部设备 / 1 搜索 / 2 参数编辑；返回列表页即清过滤，列表始终是全量。
watch(page, value => { if (value === 0) search.value = '' })
watch(open, value => { if (value) refresh() })
function toggle(id) { if (!pending.value || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id]) }
function toggleAll() { if (!pending.value || props.busy) return; emit('select', allSelected.value ? [] : props.draft.actions.map(action => action.id)) }
function configure(action) { if (props.busy || !pending.value) return; currentId.value = action.id; parameterError.value = ''; if (props.browser) { editorBack.value = page.value; page.value = 2 } }
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
.pages { height:100%; }.editor-page { display:flex; flex-direction:column; height:100%; overflow:hidden; }.browser-page-frame { position:relative; flex:1; min-height:0; overflow:hidden; }.browser-page { position:absolute; inset:0; display:flex; flex-direction:column; background:#fcfdfc; transform:translateX(0); transition:transform 280ms cubic-bezier(.22,.8,.24,1); }.browser-page-frame.search .list-page { transform:translateX(-100%); }.browser-page-frame:not(.search) .search-page { transform:translateX(100%); }.search-page { transform:translateX(0); }.search-scroll-shell { flex:1; min-height:0; overflow:hidden; }.browser { height:100%; }.device-scroll-shell { flex:1; min-height:0; overflow:hidden; }.stale-note { display:flex; align-items:center; gap:8px; margin:12px 20px 0; padding:9px 12px; border-radius:8px; background:#fbf3e2; color:#7a5a16; font-size:12px; line-height:1.5; flex-shrink:0; }.stale-note text { flex:1; min-width:0; }.stale-revalidate { min-height:32px; margin:0; padding:0 12px; border-radius:7px; background:#176b54; color:white; font-size:12px; line-height:30px; white-space:nowrap; flex-shrink:0; }.stale-revalidate--pressed { transform:scale(.97); opacity:.85; }.stale-revalidate[disabled] { opacity:.4; }.stale-revalidate::after { border:0; }.controls { position:relative; z-index:3; display:flex; align-items:center; gap:8px; height:48px; padding:0 20px; flex-shrink:0; }.group-picker-wrap { position:relative; flex:1; min-width:0; }.group-picker { display:flex; align-items:center; justify-content:space-between; width:100%; height:36px; margin:0; padding:0 14px; border:1px solid #d8e1dc; border-radius:10px; background:#f4f7f5; color:#24382d; font-size:13px; line-height:36px; text-align:left; }.group-picker.open { border-color:#176b54; background:#fff; }.chevron { width:8px; height:8px; border-right:1.5px solid #60746a; border-bottom:1.5px solid #60746a; transform:rotate(45deg) translateY(-2px); transition:transform 180ms ease; }.group-picker.open .chevron { transform:rotate(225deg) translate(-1px,-1px); }.group-menu { position:absolute; left:0; right:0; top:42px; padding:4px; border:1px solid #d8e1dc; border-radius:12px; background:#fff; box-shadow:0 10px 24px #18392a1c; overflow:hidden; }.group-option { display:flex; align-items:center; justify-content:space-between; width:100%; height:38px; margin:0; padding:0 11px; border-radius:8px; background:transparent; color:#5d6963; font-size:13px; line-height:38px; text-align:left; }.group-option.active { background:#edf4f0; color:#176b54; font-weight:500; }.group-check { color:#176b54; font-size:14px; }.search-toggle { width:36px; height:36px; margin:0; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid #d8e1dc; background:#f4f7f5; border-radius:18px; flex-shrink:0; transition:transform 120ms ease-out,background 160ms ease; }.search-toggle--pressed { transform:scale(.94); background:#e8efeb; }.search-toggle-icon { display:block; width:15px; height:15px; }.search-row { display:flex; align-items:center; gap:8px; height:42px; margin:8px 20px 10px; padding:0 14px; border:1px solid #d8e1dc; background:#f7faf8; border-radius:12px; flex-shrink:0; }.search-field-icon { display:block; width:15px; height:15px; flex-shrink:0; }.search-input { flex:1; height:100%; font-size:13px; color:#24382d; }.device-list { height:100%; box-sizing:border-box; padding:0 20px; }.group { margin-bottom:20px; }.group-title { display:block; font-size:12px; font-weight:500; color:#5d6963; margin-bottom:12px; }.grid { display:flex; flex-wrap:wrap; gap:12px; }.grid :deep(.device-card) { width:calc(50% - 6px); }.browser-footer { display:flex; padding:12px 20px; border-top:1px solid #e3e8e4; }.header-select-all { min-width:48px; height:36px; margin:0; padding:0 2px; background:transparent; color:#176b54; font-size:12px; line-height:36px; white-space:nowrap; }.header-select-all--pressed { opacity:.65; }.header-select-all[disabled] { opacity:.4; }.primary { flex:1; display:flex; align-items:center; justify-content:center; min-height:44px; margin:0; padding:0 14px; font-size:14px; font-weight:500; line-height:44px; background:#176b54; color:white; border-radius:9px; transition:transform 120ms ease-out,opacity 150ms ease; }.primary--pressed { transform:scale(.98); opacity:.92; }.primary[disabled] { opacity:.55; }.back { display:flex; align-items:center; gap:6px; margin:0; padding:0 20px; font-size:12px; line-height:40px; background:transparent; color:#728178; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.back--pressed { transform:scale(.97); opacity:.7; }.back-icon { display:block; width:14px; height:14px; }.note { display:block; font-size:13px; color:#5d6963; margin:12px 20px; }button::after { border:0; }@media(prefers-reduced-motion:reduce){.primary,.search-toggle,.browser-page,.group-picker,.chevron{transition:none;}}
</style>
