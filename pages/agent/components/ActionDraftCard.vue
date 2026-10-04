<template>
 <view class="draft" :class="{ 'draft--embedded': embedded }">
  <view v-if="!embedded" class="heading"><text>{{ heading }}</text><text>{{ selected.length }} / {{ draft.actions.length }} 已选</text></view>
  <view class="scope-row"><button class="scope" @tap="scopeOpen = !scopeOpen"><text>操作范围</text><uni-icons :type="scopeOpen ? 'down' : 'right'" size="12" color="#718078" /></button><button class="state-refresh" aria-label="刷新设备状态" :disabled="busy || stateLoading" @tap="stateRefresh.run()"><uni-icons :class="{ spinning: stateLoading }" type="refreshempty" size="16" color="#718078" /></button></view>
  <text v-if="scopeOpen" class="note">{{ draft.summary }}</text>
  <text v-if="pending && draft.question" class="note">{{ draft.question }}</text>
  <text v-if="!result && historyNote" class="note">{{ historyNote }}</text>
  <view class="rail-frame"><scroll-view scroll-x enhanced :show-scrollbar="false" class="rail"><view class="rail-inner">
   <DeviceActionCard v-for="(action,index) in preview" :key="action.id" :action="action" :index="index" :selected="selected.includes(action.id)" :readonly="!pending" :disabled="busy" :phase="phase(action)" :current-state="states[action.deviceId] ?? null" :operation="operationLabel(action)" :outcome-label="outcome(action)" @toggle="toggle(action.id)" @configure="emit('configure', action)" />
   <button v-if="draft.actions.length > 4" class="overflow" @tap="emit('browse')"><text class="overflow-count">+{{ draft.actions.length - 3 }}</text><text>查看全部</text><uni-icons type="right" color="white" size="16" /></button>
  </view></scroll-view></view>
  <view v-if="pending && !embedded" class="actions"><text class="selection-status">已选 {{ selected.length }} 项</text><button class="quiet" :disabled="busy" hover-class="quiet--pressed" @tap="emit('cancel')">取消</button><button class="primary" :disabled="busy || !selected.length" :loading="busy" hover-class="primary--pressed" @tap="emit('confirm')">执行操作</button></view>
  <button v-if="draft.status === 'EXPIRED' && !embedded" class="quiet" :disabled="busy" @tap="emit('revalidate')">重新核验</button>
  <view v-if="(result || draft.status === 'EXECUTING') && !embedded" class="receipt"><uni-icons :class="{ spinning: draft.status === 'EXECUTING' }" :type="draft.status === 'EXECUTING' ? 'loop' : result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? 'info' : 'checkmarkempty'" size="16" :color="result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? '#ad711b' : '#526d5e'" /><text>{{ result?.message || '正在执行，请稍候' }}</text></view>
 </view>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { readDeviceStates } from '@/apis/agent'
import { operationLabel } from '../ac-draft.js'
import { receiptPhase } from '../device-card-state.js'
import { createStateRefresh } from '../state-refresh.mjs'
import { receiptText } from '../conversation.mjs'
import DeviceActionCard from './DeviceActionCard.vue'
const props = defineProps({ source: { type: String, default: 'office' }, draft: {type:Object,required:true}, result:Object, busy:Boolean, embedded:Boolean })
const emit = defineEmits(['confirm','cancel','select','revalidate','updated','editing','configure','browse'])
const scopeOpen = ref(false), states = ref({}), stateLoading = ref(false)
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const historyNote = computed(() => ({EXPIRED:'核验已过期，未执行。重新核验后需再次确认。',CANCELLED:'操作已取消，未执行。发送新指令可重新下达。',NO_CHANGE:'核验时已达到目标，未发送控制指令。',INTERRUPTED:'执行中断，部分指令可能已下发，以设备实际状态为准。'}[props.draft.status] || ''))
const selected = computed(() => props.draft.selectedActionIds || [])
const preview = computed(() => props.draft.actions.length > 4 ? props.draft.actions.slice(0,3) : props.draft.actions)
const heading = computed(() => ({PENDING_CONFIRMATION:'待确认操作',EXECUTING:'正在执行',CANCELLED:'草案已取消',EXPIRED:'草案已过期',NO_CHANGE:'无需操作',INTERRUPTED:'执行中断'}[props.draft.status] || '操作结果'))
function toggle(id) { if (!pending.value || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value,id]) }
function receipt(action) { return props.result?.receipts?.find(r => r.actionId === action.id) }
function outcome(action) { return receiptText(receipt(action)) }
function phase(action) {
 if (props.result) return receiptPhase(action, receipt(action)?.outcome ?? (selected.value.includes(action.id) ? props.result.status : 'UNSELECTED'), props.result.readback?.[action.id])
 return props.draft.status === 'CANCELLED' ? 'cancelled' : props.draft.status === 'EXPIRED' ? 'expired' : 'pending'
}
async function refresh() {
 const current = ++stateRequest, draftId = props.draft.draftId
 stateLoading.value = true
 try {
  const snapshot = await readDeviceStates(draftId, props.source)
  if (current === stateRequest && props.draft.draftId === draftId) states.value = snapshot.states || {}
 } catch { if (current === stateRequest) states.value = {} }
 finally { if (current === stateRequest) stateLoading.value = false }
}
let stateRequest = 0
const stateRefresh = createStateRefresh(refresh)
watch(() => props.result, result => { if (result) { ++stateRequest; states.value = {}; stateLoading.value = false; stateRefresh.after(1000) } })
watch(pending, value => { if (value) stateRefresh.auto() })
onMounted(() => stateRefresh.auto())
onUnmounted(() => { stateRefresh.cancel(); ++stateRequest })
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.scope-row { display:flex; align-items:center; justify-content:space-between; }
.state-refresh { width:32px; height:32px; margin:6px 0 0; padding:0; display:flex; align-items:center; justify-content:center; background:transparent; }
.state-refresh[disabled] { opacity:.5; }
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
.draft { margin-top:12px; padding-top:12px; border-top:1px solid #dbe3dd; }
/* 面板内嵌模式：外卡 chrome（头部/底栏/边距）由 ActionPanel 统一供给。 */
.draft--embedded { margin-top:0; padding-top:0; border-top:0; }.heading { display:flex; justify-content:space-between; color:#63756b; font-size:12px; gap:12px; }.heading text:last-child { color:#74817a; font-size:11px; }.scope { display:flex; align-items:center; gap:5px; background:transparent; padding:0; margin:6px 0 0; font-size:12px; color:#718078; line-height:30px; }.note { display:block; font-size:13px; color:#5d6963; line-height:1.6; margin-top:6px; }.rail-frame { position:relative; margin-top:8px; overflow:hidden; }.rail { width:100%; white-space:nowrap; -webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0,#000 20px,#000 calc(100% - 20px),rgba(0,0,0,0) 100%); mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0,#000 20px,#000 calc(100% - 20px),rgba(0,0,0,0) 100%); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }.rail-inner { display:inline-flex; gap:8px; padding:2px 16px 9px; }.overflow { display:flex; width:119px; height:182px; flex-shrink:0; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:#123f32; color:white; border-radius:6px; font-size:12px; padding:0; margin:0; }.overflow-count { font-size:24px; }.actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; min-height:44px; padding-top:4px; }.selection-status { margin-right:auto; color:#7a8880; font-size:11px; line-height:44px; white-space:nowrap; }.quiet,.primary { display:flex; align-items:center; justify-content:center; min-width:0; min-height:44px; margin:0; padding:0 12px; border-radius:10px; font-size:12px; line-height:44px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 160ms ease,box-shadow 160ms ease,opacity 160ms ease; }.quiet { min-width:48px; border:0; background:transparent; color:#718078; }.primary { min-width:112px; border:1px solid #176b54; background:#176b54; color:white; box-shadow:0 4px 10px #176b5422; }.primary[disabled] { opacity:.52; box-shadow:none; }.quiet[disabled] { opacity:.45; }.quiet--pressed,.primary--pressed { transform:scale(.975); }.quiet--pressed { background:#eef3ef; }.primary--pressed { background:#126149; box-shadow:0 2px 6px #176b541c; }.receipt { display:flex; align-items:center; gap:8px; min-height:49px; font-size:12px; color:#526d5e; }button::after { border:0; }
@media(prefers-reduced-motion:reduce){.spinning{animation:none}}
</style>
