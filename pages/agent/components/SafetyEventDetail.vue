<template>
 <view class="event-content">
  <scroll-view class="event-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="event-paper">
    <view class="event-heading"><view class="event-symbol"><uni-icons type="notification" size="22" color="#a47b35" /></view><text class="event-kind">{{ safetySubtypeText(record.subtype) }}台账记录</text><text class="event-mark">{{ record.report === true ? '已上报' : record.report === false ? '未上报' : '标记未知' }}</text></view>
    <text class="event-name">{{ record.deviceName || '设备名称未提供' }}</text>
    <view class="event-field"><text>安装位置</text><text>{{ record.location || '未提供' }}</text></view>
    <view class="event-field"><text>记录时间</text><text>{{ fmtDateTime(record.occurredAt) || '未提供' }}</text></view>
    <view class="event-field"><text>台账来源</text><text>{{ record.ledger === 'gas' ? '燃气台账' : record.ledger === 'flooding' ? '烟感 / 水浸台账' : '未提供' }}</text></view>
    <text class="event-note">这是平台历史台账。上报标记不代表已恢复，当前是否仍在报警需另行核实。</text>
    <text class="event-observed">{{ verified ? '核验于' : '此前读取于' }} {{ fmtDateTime(observedAt) || '时间未提供' }}</text>
   </view>
   <view class="event-state" aria-live="polite"><text>{{ loading ? '正在核验这条记录，可先查看或返回' : error }}</text><button v-if="error && reference" class="event-retry" hover-class="event-pressed" @tap="load">重试</button></view>
  </scroll-view>
  <view class="event-actions"><button class="event-reference" :disabled="!verified || loading" hover-class="event-pressed" @tap="quote"><uni-icons type="chatbubble" size="16" color="#fff" /><text>引用到对话</text></button><text class="event-action-note">保留现有输入，由你决定何时发送</text></view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { getSafetyEvent } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import { fmtDateTime, safetySubtypeText } from '../observation-view.mjs'
import { safetyEventReference } from '../safety-event.mjs'

const props = defineProps({ snapshot: { type: Object, required: true }, active: Boolean })
const emit = defineEmits(['reference'])
const record = ref(props.snapshot.record), observedAt = ref(props.snapshot.observedAt)
const loading = ref(false), error = ref(''), verified = ref(false)
const reference = computed(() => safetyEventReference(props.snapshot.record))
let requestId = 0, visible = true, verifiedScope = ''
function invalidate() { ++requestId; loading.value = false; verified.value = false }
async function load() {
 const current = ++requestId
 verified.value = false; error.value = ''
 if (!props.active || !visible) return
 const target = reference.value
 if (!target) { error.value = '这条记录缺少稳定身份，仅可查看此前快照'; return }
 loading.value = true
 let scope
 try {
  scope = getAgentStorageScope()
  const result = await getSafetyEvent(target)
  if (current !== requestId || !visible || !props.active || scope !== getAgentStorageScope()) return
  const next = safetyEventReference(result.record)
  if (!next || next.eventId !== target.eventId || next.ledger !== target.ledger || next.deviceId !== target.deviceId) throw new Error('返回的记录身份不匹配，请重试')
  record.value = result.record; observedAt.value = result.observedAt; verifiedScope = scope; verified.value = true
 } catch (cause) {
  if (current === requestId && visible && props.active) {
   if (scope !== getAgentStorageScope() || ['SAFETY_EVENT_UNAVAILABLE', 'UNAUTHORIZED'].includes(cause.data?.code)) record.value = {}
   error.value = cause.message || '记录暂不可用，请稍后重试'
  }
 } finally { if (current === requestId) loading.value = false }
}
function quote() {
 if (!verified.value || loading.value || verifiedScope !== getAgentStorageScope()) return
 emit('reference', { ...reference.value, label: `${record.value.deviceName} · ${fmtDateTime(record.value.occurredAt)}` })
}
watch(() => [props.active, props.snapshot], () => {
 invalidate(); record.value = props.snapshot.record; observedAt.value = props.snapshot.observedAt
 if (props.active) void load()
}, { immediate: true })
onHide(() => { visible = false; invalidate() })
onShow(() => { visible = true; if (props.active) void load() })
onBeforeUnmount(invalidate)
</script>
<style scoped>
view,text { font-size:inherit; line-height:inherit; } button { margin:0; padding:0; font-size:inherit; line-height:inherit; } button::after { border:0; }
.event-content { flex:1; min-height:0; display:flex; flex-direction:column; color:#2c4436; font-size:13px; line-height:1.5; }
.event-scroll { height:0; flex:1; min-height:0; }.event-paper { margin:8px 20px 0; padding:18px; border-radius:16px; background:linear-gradient(#fbfcf8,#f3f7f1); border:1px solid #e0e7dc; box-shadow:inset 0 1px 0 #fff,0 3px 9px -7px #36503c50; }
.event-heading { display:flex; align-items:center; gap:8px; }.event-symbol { display:flex; align-items:center; justify-content:center; width:35px; height:35px; flex-shrink:0; border-radius:11px; background:#f0eadb; }.event-kind { flex:1; color:#7e8d7f; font-size:12px; }.event-mark { flex-shrink:0; padding:3px 8px; border-radius:8px; background:#f1ead7; color:#8d6f2b; font-size:11px; }
.event-name { display:block; margin:16px 0 20px; font-size:19px; font-weight:600; line-height:1.4; overflow-wrap:anywhere; }.event-field { display:flex; justify-content:space-between; gap:18px; padding:11px 0; border-top:1px solid #e1e7dd; }.event-field text:first-child { flex-shrink:0; color:#809083; }.event-field text:last-child { text-align:right; overflow-wrap:anywhere; }
.event-note { display:block; margin-top:18px; color:#8f794c; font-size:12px; }.event-observed { display:block; margin-top:12px; color:#8b998e; font-size:11px; }.event-state { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:44px; margin:8px 20px; color:#859287; font-size:12px; }.event-retry { flex-shrink:0; min-height:44px; padding:0 12px; background:transparent; color:#176b54; }
.event-actions { flex-shrink:0; padding:14px 20px 12px; border-top:1px solid #e7ece5; }.event-reference { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:46px; border-radius:13px; background:linear-gradient(#297c61,#17654e); box-shadow:inset 0 1px 0 #ffffff30,0 3px 8px -5px #164c3b70; color:#fff; font-weight:600; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.event-reference[disabled] { opacity:.45; }.event-action-note { display:block; margin-top:8px; text-align:center; color:#89968c; font-size:11px; }.event-pressed { opacity:.72; transform:scale(.98); } @media(prefers-reduced-motion:reduce) { .event-reference { transition:none; } }
</style>
