<template>
 <view class="draft">
  <view class="heading"><text>{{ heading }}</text><text>{{ selected.length }} / {{ draft.actions.length }} 已选</text></view>
  <button class="scope" @tap="scopeOpen = !scopeOpen"><text>操作范围</text><uni-icons :type="scopeOpen ? 'down' : 'right'" size="12" color="#718078" /></button>
  <text v-if="scopeOpen" class="note">{{ draft.summary }}</text>
  <text v-if="pending && draft.question" class="note">{{ draft.question }}</text>
  <text v-if="!result && historyNote" class="note">{{ historyNote }}</text>
  <view class="rail-frame"><scroll-view scroll-x enhanced :show-scrollbar="false" class="rail"><view class="rail-inner">
   <DeviceActionCard v-for="(action,index) in preview" :key="action.id" :action="action" :index="index" :selected="selected.includes(action.id)" :readonly="!pending" :disabled="busy" :phase="phase(action)" :current-state="states[action.deviceId] ?? null" :operation="operationLabel(action)" :outcome-label="outcome(action)" @toggle="toggle(action.id)" @configure="emit('configure', action)" />
   <button v-if="draft.actions.length > 4" class="overflow" @tap="emit('browse')"><text class="overflow-count">+{{ draft.actions.length - 3 }}</text><text>查看全部</text><uni-icons type="right" color="white" size="16" /></button>
  </view></scroll-view></view>
  <view v-if="pending" class="actions"><button class="quiet" :disabled="busy" hover-class="quiet--pressed" @tap="emit('cancel')">取消草案</button><button class="primary" :disabled="busy || !selected.length" :loading="busy" hover-class="primary--pressed" @tap="emit('confirm')"><image class="primary-icon" src="/static/check.svg" />确认草案</button></view>
  <button v-if="draft.status === 'EXPIRED'" class="quiet" :disabled="busy" @tap="emit('revalidate')">重新核验</button>
  <view v-if="result || draft.status === 'EXECUTING'" class="receipt"><uni-icons :class="{ spinning: draft.status === 'EXECUTING' }" :type="draft.status === 'EXECUTING' ? 'loop' : result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? 'info' : 'checkmarkempty'" size="16" :color="result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? '#a66a13' : '#526d5e'" /><text>{{ result?.message || '正在执行，请稍候' }}</text></view>
  <text v-if="result" class="observation">{{ observation }}</text>
 </view>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { readDeviceStates } from '@/apis/agent'
import { operationLabel } from '../ac-draft.js'
import { receiptPhase } from '../device-card-state.js'
import { receiptText } from '../conversation.mjs'
import DeviceActionCard from './DeviceActionCard.vue'
const props = defineProps({ draft: {type:Object,required:true}, result:Object, busy:Boolean })
const emit = defineEmits(['confirm','cancel','select','revalidate','updated','editing','configure','browse'])
const scopeOpen = ref(false), states = ref({}), observation = ref('')
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const historyNote = computed(() => ({EXPIRED:'核验已过期，未执行。重新核验后需再次确认。',CANCELLED:'操作已取消，未执行。',NO_CHANGE:'核验时已达到目标，未发送控制指令。'}[props.draft.status] || ''))
const selected = computed(() => props.draft.selectedActionIds || [])
const preview = computed(() => props.draft.actions.length > 4 ? props.draft.actions.slice(0,3) : props.draft.actions)
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
watch(() => props.result, refresh)
watch(pending, value => { if (value) refresh() })
onMounted(refresh)
</script>
<style scoped>
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
.draft { margin-top:12px; padding-top:12px; border-top:1px solid #dbe3dd; }.heading { display:flex; justify-content:space-between; color:#63756b; font-size:12px; gap:12px; }.heading text:last-child { color:#74817a; font-size:11px; }.scope { display:flex; align-items:center; gap:5px; background:transparent; padding:0; margin:6px 0 0; font-size:12px; color:#718078; line-height:30px; }.note { display:block; font-size:13px; color:#5d6963; line-height:1.6; margin-top:6px; }.rail-frame { position:relative; margin-top:8px; overflow:hidden; }.rail { width:100%; white-space:nowrap; }.rail-inner { display:inline-flex; gap:8px; padding:2px 12px 9px; }.rail-frame::before,.rail-frame::after { position:absolute; top:0; bottom:0; width:10px; content:''; z-index:9; pointer-events:none; }.rail-frame::before { left:0; background:linear-gradient(90deg,#f4f7f5,transparent); }.rail-frame::after { right:0; background:linear-gradient(270deg,#f4f7f5,transparent); }.overflow { display:flex; width:119px; height:182px; flex-shrink:0; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:#123f32; color:white; border-radius:6px; font-size:12px; padding:0; margin:0; }.overflow-count { font-size:24px; }.actions { display:flex; align-items:center; justify-content:space-between; min-height:49px; gap:12px; }.quiet { min-height:44px; padding:0 8px; margin:0; background:transparent; color:#6b7771; font-size:12px; line-height:40px; }.primary { display:flex; align-items:center; justify-content:center; gap:7px; min-width:132px; min-height:44px; margin:0; padding:0 14px; font-size:12px; line-height:36px; background:#176b54; color:white; border-radius:7px; }.primary[disabled] { opacity:.55; }.quiet--pressed,.primary--pressed { transform:scale(.97); }.primary-icon { width:16px; height:16px; }.receipt { display:flex; align-items:center; gap:8px; min-height:49px; font-size:12px; color:#526d5e; }.observation { display:block; color:#829087; font-size:10px; }button::after { border:0; }
</style>
