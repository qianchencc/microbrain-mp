<template>
 <view class="draft">
  <view class="heading"><text>{{ heading }}</text><text>{{ selected.length }} / {{ draft.actions.length }} 已选</text></view>
  <button class="scope" @tap="scopeOpen = !scopeOpen"><text>操作范围</text><uni-icons :type="scopeOpen ? 'down' : 'right'" size="12" color="#718078" /></button>
  <text v-if="scopeOpen" class="note">{{ draft.summary }}</text>
  <text v-if="pending && draft.question" class="note">{{ draft.question }}</text>
  <text v-if="!result && historyNote" class="note">{{ historyNote }}</text>
  <view class="rail-frame"><scroll-view scroll-x enhanced :show-scrollbar="false" class="rail"><view class="rail-inner">
   <DeviceActionCard v-for="(action,index) in preview" :key="action.id" :action="action" :index="index" :selected="selected.includes(action.id)" :readonly="!pending" :disabled="busy" :phase="phase(action)" :current-state="states[action.deviceId] ?? null" :operation="operationLabel(action)" :outcome-label="outcome(action)" @toggle="toggle(action.id)" @configure="configure(action)" />
   <button v-if="draft.actions.length > 4" class="overflow" @tap="openBrowser"><text class="overflow-count">+{{ draft.actions.length - 3 }}</text><text>查看全部</text><uni-icons type="right" color="white" size="16" /></button>
  </view></scroll-view></view>
  <view v-if="pending" class="actions"><button class="quiet" :disabled="busy" @tap="emit('cancel')">取消草案</button><button class="primary" :disabled="busy || !selected.length" :loading="busy" @tap="emit('confirm')"><uni-icons type="checkmarkempty" size="16" color="white" />确认草案</button></view>
  <button v-if="draft.status === 'EXPIRED'" class="quiet" :disabled="busy" @tap="emit('revalidate')">重新核验</button>
  <view v-if="result || draft.status === 'EXECUTING'" class="receipt"><uni-icons :class="{ spinning: draft.status === 'EXECUTING' }" :type="draft.status === 'EXECUTING' ? 'loop' : result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? 'info' : 'checkmarkempty'" size="16" :color="result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? '#a66a13' : '#526d5e'" /><text>{{ result?.message || '正在执行，请稍候' }}</text></view>
  <text v-if="result" class="observation">{{ observation }}</text>
  <DeviceSheet :open="sheetOpen" :title="browser ? '全部设备' : current?.kind === 'ac' ? '空调调节' : '开门设置'" :subtitle="browser ? selected.length + ' / ' + draft.actions.length + ' 已选' : current?.deviceName" :busy="busy" @close="closeSheet">
   <swiper v-if="browser" class="pages" :current="page" :duration="250" :disable-touch="!current || busy" @change="changePage">
    <swiper-item><view class="browser">
     <view class="toolbar"><picker :range="groupLabels" :value="groupIndex" @change="groupIndex = Number($event.detail.value)"><view class="group-choice">{{ groupLabels[groupIndex] }}<uni-icons type="down" size="12" color="#718078" /></view></picker><button v-if="pending" class="quiet" :disabled="busy" @tap="emit('select', selected.length === draft.actions.length ? [] : draft.actions.map(a => a.id))">{{ selected.length === draft.actions.length ? '取消全选' : '全选' }}</button></view>
     <input v-model="search" class="search" placeholder="搜索设备" />
     <scroll-view scroll-y enhanced :show-scrollbar="false" class="device-list"><view v-for="group in groups" :key="group.key" class="group"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="!pending" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text></scroll-view>
     <view v-if="pending" class="browser-footer"><text>{{ selected.length }} 项已选</text><button class="primary" :disabled="busy || !selected.length" @tap="closeSheet(); emit('confirm')">确认草案</button></view>
    </view></swiper-item>
    <swiper-item v-if="current"><view class="editor-page"><button class="back" @tap="page = 0"><uni-icons type="left" size="16" color="#718078" /><text>{{ current.deviceName }}</text></button><ParameterEditor :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" /></view></swiper-item>
   </swiper>
   <ParameterEditor v-else-if="current" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
  </DeviceSheet>
 </view>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { readDeviceStates, updateParameters } from '@/apis/agent'
import { operationLabel } from '../ac-draft.js'
import { receiptPhase } from '../device-card-state.js'
import { createDraftGroups } from '../action-draft-presentation.js'
import { receiptText } from '../conversation.mjs'
import DeviceActionCard from './DeviceActionCard.vue'
import DeviceSheet from './DeviceSheet.vue'
import ParameterEditor from './ParameterEditor.vue'
const props = defineProps({ draft: {type:Object,required:true}, result:Object, busy:Boolean })
const emit = defineEmits(['confirm','cancel','select','revalidate','updated','editing'])
const scopeOpen = ref(false), states = ref({}), observation = ref('')
const sheetOpen = ref(false), browser = ref(false), current = ref(null), page = ref(0), search = ref(''), groupIndex = ref(0), parameterError = ref('')
const groupLabels = ['按区域分组','按设备类型分组','按选择分组']
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const historyNote = computed(() => ({EXPIRED:'核验已过期，未执行。重新核验后需再次确认。',CANCELLED:'操作已取消，未执行。',NO_CHANGE:'核验时已达到目标，未发送控制指令。'}[props.draft.status] || ''))
const selected = computed(() => props.draft.selectedActionIds || [])
const preview = computed(() => props.draft.actions.length > 4 ? props.draft.actions.slice(0,3) : props.draft.actions)
const groups = computed(() => createDraftGroups(props.draft.actions.filter(a => (a.deviceName + a.location).includes(search.value.trim())), selected.value, {groupBy:['location','kind','selection'][groupIndex.value]}))
const heading = computed(() => ({PENDING_CONFIRMATION:'待确认操作',EXECUTING:'正在执行',CANCELLED:'草案已取消',EXPIRED:'草案已过期',NO_CHANGE:'无需操作'}[props.draft.status] || '操作结果'))
function toggle(id) { if (!pending.value || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value,id]) }
function receipt(action) { return props.result?.receipts?.find(r => r.actionId === action.id) }
function outcome(action) { return receiptText(receipt(action)) }
function phase(action) {
 if (props.result) return receiptPhase(action, receipt(action)?.outcome ?? (selected.value.includes(action.id) ? props.result.status : 'UNSELECTED'), states.value[action.deviceId])
 return props.draft.status === 'CANCELLED' ? 'cancelled' : props.draft.status === 'EXPIRED' ? 'expired' : 'pending'
}
async function refresh() {
 try { const snapshot = await readDeviceStates(props.draft.draftId); states.value = snapshot.states; observation.value = (snapshot.source === 'simulation' ? '模拟状态' : '设备状态') + ' · 查询于 ' + new Date(snapshot.observedAt).toLocaleTimeString('zh-CN') }
 catch { states.value = {}; observation.value = '设备状态暂不可用，回执不代表设备已到位' }
}
function openBrowser() { browser.value = true; current.value = null; page.value = 0; sheetOpen.value = true }
function configure(action) { if (!pending.value || props.busy) return; current.value = action; parameterError.value = ''; if (sheetOpen.value && browser.value) page.value = 1; else { browser.value = false; sheetOpen.value = true } refresh() }
function closeSheet() { if (!props.busy) sheetOpen.value = false }
function changePage(event) { if (event.detail.source === 'touch') page.value = event.detail.current }
async function save(changes) {
 if (props.busy || !pending.value) return
 emit('editing',true); parameterError.value = ''
 try { const updated = await updateParameters(props.draft.draftId,props.draft.revision,changes); emit('updated',updated); if (browser.value) { page.value = 0; current.value = updated.actions.find(a => a.id === current.value.id) || current.value } else sheetOpen.value = false }
 catch(error) { parameterError.value = error.message }
 finally { emit('editing',false) }
}
watch(() => props.result, refresh)
watch(pending, value => { if (!value) sheetOpen.value = false; else refresh() })
onMounted(refresh)
</script>
<style scoped>
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
.draft { margin-top:12px; padding-top:12px; border-top:1px solid #dbe3dd; }.heading { display:flex; justify-content:space-between; color:#63756b; font-size:12px; gap:12px; }.heading text:last-child { color:#74817a; font-size:11px; }.scope { display:flex; align-items:center; gap:5px; background:transparent; padding:0; margin:6px 0 0; font-size:12px; color:#718078; line-height:30px; }.note { display:block; font-size:13px; color:#5d6963; line-height:1.6; margin-top:6px; }.rail-frame { position:relative; margin-top:8px; overflow:hidden; }.rail { width:100%; white-space:nowrap; }.rail-inner { display:inline-flex; gap:8px; padding:2px 12px 9px; }.rail-frame::before,.rail-frame::after { position:absolute; top:0; bottom:0; width:10px; content:''; z-index:9; pointer-events:none; }.rail-frame::before { left:0; background:linear-gradient(90deg,#f4f7f5,transparent); }.rail-frame::after { right:0; background:linear-gradient(270deg,#f4f7f5,transparent); }.overflow { display:flex; width:119px; height:182px; flex-shrink:0; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:#123f32; color:white; border-radius:6px; font-size:12px; padding:0; margin:0; }.overflow-count { font-size:24px; }.actions { display:flex; align-items:center; justify-content:space-between; min-height:49px; gap:12px; }.quiet { padding:0; margin:0; background:transparent; color:#6b7771; font-size:12px; line-height:40px; }.primary { display:flex; align-items:center; justify-content:center; gap:7px; min-width:120px; min-height:36px; margin:0; padding:0 14px; font-size:12px; line-height:36px; background:#176b54; color:white; border-radius:7px; }.primary[disabled] { opacity:.55; }.receipt { display:flex; align-items:center; gap:8px; min-height:49px; font-size:12px; color:#526d5e; }.observation { display:block; color:#829087; font-size:10px; }.pages { height:76vh; }.browser { display:flex; flex-direction:column; height:100%; }.toolbar { display:flex; justify-content:space-between; padding:12px 20px; align-items:center; }.group-choice { display:flex; align-items:center; gap:16px; border:1px solid #d5dfd8; border-radius:6px; padding:12px; font-size:13px; }.search { margin:0 20px 12px; padding:10px 12px; font-size:13px; background:#edf1ee; border-radius:6px; }.device-list { flex:1; height:0; box-sizing:border-box; padding:0 20px; }.group { margin-bottom:20px; }.group-title { display:block; font-size:12px; color:#728178; margin-bottom:12px; }.grid { display:flex; flex-wrap:wrap; gap:12px; }.browser-footer { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid #e3e8e4; font-size:12px; color:#728178; }.back { display:flex; align-items:center; gap:8px; margin:0; padding:0 20px; font-size:12px; line-height:36px; background:transparent; color:#728178; }.back text { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }button::after { border:0; }
</style>
