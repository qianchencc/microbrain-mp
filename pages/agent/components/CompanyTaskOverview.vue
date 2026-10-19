<template>
 <view class="overview">
  <view class="overview-head"><text class="overview-title">任务日历</text><button class="inbox-link" @tap="open('inbox')"><uni-icons type="email" size="15" color="#176b54" /><text>收件箱</text><text v-if="unread" class="unread">{{ unread > 99 ? '99+' : unread }}</text></button></view>
  <TaskCalendarView compact :active="active" :date="date" :refresh-key="refreshKey" source="company" @date-change="date = $event" @select-task="task => open('schedule', task)" @open-date="open('schedule')" @refreshed="refreshUnread" />
  <view class="overview-actions"><button @tap="open('schedule')">查看当天任务 <uni-icons type="right" size="11" color="#176b54" /></button><button @tap="open('plans')">周期计划 <uni-icons type="right" size="11" color="#176b54" /></button></view>
 </view>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { listNotifications } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import TaskCalendarView from './TaskCalendarView.vue'
import { taskToday } from '../task-calendar.mjs'
const props = defineProps({ active: Boolean, refreshKey: Number })
const emit = defineEmits(['open'])
const date = ref(taskToday()), unread = ref(0)
let generation = 0, loadedScope = ''
function open(view, task) { emit('open', { view, date: date.value, task }) }
async function refreshUnread() {
 if (!props.active) return
 const current = ++generation
 try {
  const scope = getAgentStorageScope()
  if (scope !== loadedScope) { unread.value = 0; loadedScope = scope }
  const result = await listNotifications({ source: 'company', limit: 1 })
  if (current === generation && props.active && scope === getAgentStorageScope()) unread.value = Number(result.unreadCount) || 0
 } catch { if (current === generation) unread.value = 0 }
}
watch(() => props.active, value => { if (!value) ++generation })
onBeforeUnmount(() => ++generation)
</script>
<style scoped>
view,text { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.4; }
button::after { border:0; }
.overview { padding:5px 0 0; }
.overview-head { display:flex; align-items:center; justify-content:space-between; padding:0 4px 6px; }
.overview-title { font-size:12px; font-weight:600; color:#6e8375; }
.inbox-link { min-height:36px; display:flex; align-items:center; gap:5px; color:#176b54; font-size:12px; }
.unread { min-width:17px; padding:2px 4px; border-radius:10px; background:#176b54; color:#fff; font-size:10px; }
.overview-actions { display:flex; border-top:1px solid #e0e8e0; }
.overview-actions button { flex:1; min-height:44px; display:flex; align-items:center; justify-content:center; gap:5px; color:#176b54; font-size:12px; }
.overview-actions button + button { border-left:1px solid #e0e8e0; }
</style>
