<template>
 <DeviceSheet :open="open" :title="browser ? '全部设备' : current?.kind === 'ac' ? '空调调节' : '开门设置'" :subtitle="browser ? selected.length + ' / ' + draft.actions.length + ' 已选' : current?.deviceName" :busy="busy" @close="emit('close')">
  <swiper v-if="browser" class="pages" :current="page" :duration="250" :disable-touch="!current || busy" @change="changePage">
   <swiper-item><view class="browser">
    <view class="toolbar"><picker :range="groupLabels" :value="groupIndex" @change="groupIndex = Number($event.detail.value)"><view class="group-choice">{{ groupLabels[groupIndex] }}<uni-icons type="down" size="12" color="#718078" /></view></picker><button class="quiet" :disabled="busy" @tap="emit('select', selected.length === draft.actions.length ? [] : draft.actions.map(a => a.id))">{{ selected.length === draft.actions.length ? '取消全选' : '全选' }}</button></view>
    <input v-model="search" class="search" placeholder="搜索设备" />
    <scroll-view scroll-y enhanced :show-scrollbar="false" class="device-list"><view v-for="group in groups" :key="group.key" class="group"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="false" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text></scroll-view>
    <view class="browser-footer"><text>{{ selected.length }} 项已选</text><button class="primary" :disabled="busy || !selected.length" @tap="emit('close'); emit('confirm')">确认草案</button></view>
   </view></swiper-item>
   <swiper-item><view class="editor-page">
    <button v-if="current" class="back" hover-class="back--pressed" @tap="page = 0"><image class="back-icon" src="/static/back.svg" /><text>{{ current.deviceName }}</text></button>
    <ParameterEditor v-if="current" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
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
const emit = defineEmits(['close', 'select', 'confirm', 'updated', 'editing'])
const states = ref({}), page = ref(0), search = ref(''), groupIndex = ref(0), parameterError = ref('')
const currentId = ref('')
const groupLabels = ['按区域分组', '按设备类型分组', '按选择分组']
const open = computed(() => Boolean(props.draft))
const selected = computed(() => props.draft?.selectedActionIds || [])
const current = computed(() => props.draft?.actions.find(action => action.id === currentId.value) ?? null)
const groups = computed(() => props.draft ? createDraftGroups(props.draft.actions.filter(action => (action.deviceName + action.location).includes(search.value.trim())), selected.value, { groupBy: ['location', 'kind', 'selection'][groupIndex.value] }) : [])
watch(() => props.currentActionId, value => { currentId.value = value }, { immediate: true })
watch(() => props.draft?.draftId, () => { page.value = 0; search.value = ''; groupIndex.value = 0; parameterError.value = '' })
watch(open, value => { if (value) refresh() })
function toggle(id) { if (!props.draft || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id]) }
function configure(action) { if (props.busy || !open.value) return; currentId.value = action.id; parameterError.value = ''; if (props.browser) page.value = 1 }
function changePage(event) { if (event.detail.source === 'touch') page.value = event.detail.current }
function receipt(action) { return props.result?.receipts?.find(item => item.actionId === action.id) }
function outcome(action) { return receiptText(receipt(action)) }
function phase(action) {
 if (props.result) return receiptPhase(action, receipt(action)?.outcome ?? (selected.value.includes(action.id) ? props.result.status : 'UNSELECTED'), states.value[action.deviceId])
 return 'pending'
}
async function refresh() {
 if (!props.draft) return
 try { const snapshot = await readDeviceStates(props.draft.draftId); states.value = snapshot.states }
 catch { states.value = {} }
}
async function save(changes) {
 if (props.busy || !props.draft || props.draft.status !== 'PENDING_CONFIRMATION') return
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
.pages { height:76vh; }.editor-page { display:flex; flex-direction:column; height:100%; overflow:hidden; }.browser { display:flex; flex-direction:column; height:100%; }.toolbar { display:flex; justify-content:space-between; padding:12px 20px; align-items:center; }.group-choice { display:flex; align-items:center; gap:16px; border:1px solid #d5dfd8; border-radius:6px; padding:12px; font-size:13px; }.search { margin:0 20px 12px; padding:10px 12px; font-size:13px; background:#edf1ee; border-radius:6px; }.device-list { flex:1; height:0; box-sizing:border-box; padding:0 20px; }.group { margin-bottom:20px; }.group-title { display:block; font-size:12px; color:#728178; margin-bottom:12px; }.grid { display:flex; flex-wrap:wrap; gap:12px; }.browser-footer { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid #e3e8e4; font-size:12px; color:#728178; }.back { display:flex; align-items:center; gap:6px; margin:0; padding:0 20px; font-size:12px; line-height:40px; background:transparent; color:#728178; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.back--pressed { transform:scale(.97); opacity:.7; }.back-icon { display:block; width:14px; height:14px; }.note { display:block; font-size:13px; color:#5d6963; margin:12px 20px; }.quiet { min-height:44px; padding:0 8px; margin:0; background:transparent; color:#6b7771; font-size:12px; line-height:40px; }.primary { display:flex; align-items:center; justify-content:center; min-width:132px; min-height:44px; margin:0; padding:0 14px; font-size:12px; line-height:36px; background:#176b54; color:white; border-radius:7px; }.primary[disabled] { opacity:.55; }button::after { border:0; }
</style>
