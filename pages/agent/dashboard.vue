<template>
 <view class="dashboard">
  <view class="nav" :style="{ paddingTop: top + 'px' }"><view class="nav-row" :style="{ height: barHeight + 'px', paddingRight: rightInset + 'px' }"><button class="back" aria-label="返回服务首页" @tap="back"><uni-icons type="back" size="20" color="#345541" /></button><text>物联助手</text></view></view>
  <scroll-view class="dashboard-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="content">
    <view class="headline"><view><text class="eyebrow">COMPANY OVERVIEW</text><text class="title">公司运行总览</text></view><button class="refresh" :disabled="loading" aria-label="刷新公司概览" @tap="load"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="19" color="#567461" /></button></view>
    <view class="estate">
     <view class="estate-grid" /><image class="campus" src="/static/agent-campus.svg" mode="aspectFit" />
     <view class="estate-top"><text class="scope-dot" /><text>微脑 · 当前接入范围</text></view>
     <text class="estate-number">{{ snapshot ? snapshot.devices.length : '—' }}<text class="estate-unit">台</text></text><text class="estate-label">已接入观察设备</text>
     <view class="estate-foot"><text>{{ snapshot ? '查询于 ' + clock : loading ? '正在读取公司数据' : '数据尚未取得' }}</text><text>园区示意</text></view>
    </view>
    <view v-if="error" class="notice"><text>{{ error }}</text><button @tap="load">重试</button></view>
    <view v-else-if="snapshot?.errors?.length" class="notice"><text>部分读数暂不可用，已取得的信息保留</text><button @tap="showErrors">查看</button></view>
    <view class="device-strip"><view v-for="cell in deviceCells" :key="cell.kind" class="device-cell"><view class="device-label"><uni-icons :type="cell.icon" size="13" color="#6e8876" /><text>{{ cell.label }}</text></view><text class="device-value">{{ snapshot ? counts[cell.kind] : '—' }}<text>台</text></text></view></view>
    <view class="panel environment">
     <view class="panel-head"><text>环境观测</text><button class="text-action" @tap="openObservation('environment')">查看 <uni-icons type="right" size="10" color="#829386" /></button></view>
     <text class="sensor-name">{{ environment?.name || (snapshot ? '暂无环境读数' : '等待环境读数') }}</text>
     <view class="environment-grid"><view v-for="cell in environmentCells" :key="cell.key"><text class="env-value">{{ metricValue(environment?.reading?.[cell.key]) }}<text>{{ cell.unit }}</text></text><text class="env-label">{{ cell.label }}</text></view></view>
     <text class="fineprint">{{ environment?.reading?.source === 'shadow' ? '平台影子值 · 可能不是该房间的实测值' : environment?.reading ? '设备观测 · 不代表全公司平均值' : '未取得有效读数' }}</text>
    </view>
    <view class="panel energy">
     <view class="panel-head"><view class="energy-title"><text>{{ demo ? '典型日用电' : '最新计量读数' }}</text><text v-if="demo" class="demo-tag">维修演示</text></view><view class="mode-switch"><button :class="{ selected: demo }" @tap="demo = true">演示</button><button :class="{ selected: !demo }" @tap="demo = false">真实</button></view></view>
     <template v-if="demo">
      <view class="energy-top"><text class="energy-value">{{ repairEnergy.total.toLocaleString() }}<text>kWh</text></text><view class="peak"><text>{{ repairEnergy.peak }} kWh</text><text>最高小时用电 · 样例</text></view></view>
      <image class="chart" :src="chart" mode="scaleToFill" aria-label="维修演示的小时用电曲线" />
      <view class="chart-axis"><text>00:00</text><text>06:00</text><text>12:00</text><text>18:00</text><text>24:00</text></view>
      <text class="fineprint demo-note">24 小时演示样例 · 非实际采集；真实接口仍读取</text>
     </template>
     <template v-else>
      <text class="sensor-name">{{ energy?.name || '暂无有效电表读数' }}</text>
      <text class="energy-value">{{ metricValue(energy?.reading?.totalActivePower) }}<text>kW</text></text>
      <text class="fineprint" :class="{ 'demo-note': energyStale(energy?.reading) }">{{ energy?.reading ? '最新已知功率 · ' + (fmtDateTime(energy.reading.readTime) || '上报时间未知') + (energyStale(energy.reading) ? ' · 陈旧/时间未知' : '') : '本次未取得有效读数' }}</text>
      <button class="meter-link" @tap="openObservation('energy')">查看 {{ snapshot ? counts.energy : '—' }} 个计量点 <uni-icons type="right" size="11" color="#567461" /></button>
     </template>
    </view>
    <button class="ledger" @tap="openObservation('alerts')"><view class="ledger-icon"><uni-icons type="notification" size="20" color="#a47b35" /></view><view class="ledger-copy"><text>安全事件台账</text><text>{{ alertsUnavailable ? '台账暂不可用' : latestAlert ? fmtDateTime(latestAlert.occurredAt) + ' · ' + latestAlert.deviceName : snapshot ? '本次读取没有事件记录' : '等待台账数据' }}</text></view><view class="ledger-count"><text>{{ snapshot?.alerts && !alertsUnavailable ? snapshot.alerts.total : '—' }}</text><text>条记录</text></view><uni-icons type="right" size="12" color="#849386" /></button>
    <text class="ledger-note">本次读取的历史台账，不表示当前仍在报警或已经恢复</text>
    <view class="panel automation">
     <view class="panel-head"><text>自动化安排</text><button class="text-action" @tap="tasksOpen = true">查看安排 <uni-icons type="right" size="10" color="#829386" /></button></view>
     <view class="automation-counts"><text>{{ snapshot?.automation?.enabledPlans ?? '—' }}<text>个启用计划</text></text><text>{{ snapshot?.automation?.active ?? '—' }}<text>项正在执行</text></text></view>
     <text v-if="!snapshot?.automation" class="fineprint">{{ snapshot?.errors?.some(row => row.area === 'automation') ? '任务摘要暂不可用' : '正在读取任务安排' }}</text>
     <button v-for="task in snapshot?.automation?.upcoming || []" :key="task.id" class="automation-row" @tap="tasksOpen = true"><text>{{ task.label }}</text><text>{{ fmtDateTime(task.interval?.startsAt || task.phases[0]?.at) }}</text></button>
     <text v-if="snapshot?.automation && !snapshot.automation.upcoming.length" class="fineprint">未来一周没有待执行安排</text>
     <view v-if="snapshot?.automation?.latestResults?.length" class="recent-results"><text class="fineprint">最近结果</text><button v-for="task in snapshot.automation.latestResults" :key="task.id" class="automation-row" @tap="tasksOpen = true"><text>{{ task.label }}</text><text>{{ resultLabel(task.status) }}</text></button></view>
    </view>
    <button class="office-gateway" hover-class="gateway-pressed" @tap="openAgent('office')"><view class="office-mark"><uni-icons type="home" size="22" color="#5b795f" /></view><view><text>办公室 Agent</text><text>办公室设备 · 对话与自动化</text></view><uni-icons type="arrow-right" size="19" color="#7a8e7e" /></button>
   </view>
  </scroll-view>
  <view class="assistant-dock"><button class="assistant" hover-class="assistant-pressed" @tap="openAgent('company')"><AgentAvatar /><view><text>公司 Agent</text><text>查询设备、能耗与告警</text></view><uni-icons type="chatboxes" size="21" color="#d4e9d6" /></button></view>
  <TaskListSheet :open="tasksOpen" source="company" @close="tasksOpen = false" @reference="referenceTask" />
  <DeviceSheet :open="Boolean(observationType)" tall compact-header :title="observationTitle" @close="observationType = ''"><scroll-view class="observation-scroll" scroll-y enhanced :show-scrollbar="false"><ObservationCard v-if="observation" :observation="observation" read-only /><text v-else class="sheet-empty">暂无可查看的数据</text></scroll-view></DeviceSheet>
 </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getCompanyDashboard } from '@/apis/agent'
import { waitForAgentSession, getAgentStorageScope } from '@/utils/agent-session'
import { navMetrics } from './nav-metrics.js'
import { dashboardCounts, metricValue, repairEnergy, energyChart } from './dashboard-view.mjs'
import { fmtDateTime, energyStale } from './observation-view.mjs'
import TaskListSheet from './components/TaskListSheet.vue'
import AgentAvatar from './components/AgentAvatar.vue'
import DeviceSheet from './components/DeviceSheet.vue'
import ObservationCard from './components/ObservationCard.vue'

const { top, barHeight, rightInset } = navMetrics()
const tasksOpen = ref(false)
const snapshot = ref(null), loading = ref(false), error = ref(''), demo = ref(true), observationType = ref('')
const counts = computed(() => dashboardCounts(snapshot.value))
const environment = computed(() => snapshot.value?.environment.find(row => row.reading) || snapshot.value?.environment[0])
const energy = computed(() => snapshot.value?.energy.find(row => Number.isFinite(row.reading?.totalActivePower)))
const alertsUnavailable = computed(() => snapshot.value?.errors?.some(row => row.area === 'alerts'))
const latestAlert = computed(() => snapshot.value?.alerts?.records[0])
const clock = computed(() => fmtDateTime(snapshot.value?.observedAt).slice(5))
const chart = energyChart(repairEnergy.hours)
const deviceCells = [{ kind: 'environment', label: '环境', icon: 'cloud' }, { kind: 'energy', label: '计量', icon: 'map' }, { kind: 'safety', label: '安全', icon: 'notification' }]
const environmentCells = [{ key: 'temp', label: '温度', unit: '°C' }, { key: 'humidity', label: '湿度', unit: '%' }, { key: 'pm25', label: 'PM2.5', unit: '' }]
const observationTitle = computed(() => ({ environment: '环境观测', energy: '最新计量读数', alerts: '安全事件台账' })[observationType.value] || '')
const observation = computed(() => {
 if (!snapshot.value || !observationType.value || (observationType.value === 'alerts' && alertsUnavailable.value)) return null
 const type = observationType.value
 return { observedAt: snapshot.value.observedAt, blocks: [type === 'alerts' ? { type, ...snapshot.value.alerts } : { type, devices: snapshot.value[type] }] }
})
let requestId = 0, scope = '', visible = false
async function load() {
 const current = ++requestId
 loading.value = true; error.value = ''
 try {
  await waitForAgentSession()
  const nextScope = getAgentStorageScope()
  if (current !== requestId || !visible) return
  if (nextScope !== scope) { snapshot.value = null; observationType.value = ''; scope = nextScope }
  const result = await getCompanyDashboard()
  if (current === requestId && visible && getAgentStorageScope() === nextScope) snapshot.value = result
 } catch (cause) {
  if (current === requestId && visible) {
   snapshot.value = null; observationType.value = ''
   error.value = cause.message || '公司数据暂不可用'
  }
 } finally { if (current === requestId) loading.value = false }
}
function openObservation(type) { if (snapshot.value) observationType.value = type }
function showErrors() { uni.showModal({ title: '部分数据暂不可用', content: snapshot.value.errors.map(row => row.message).join('\n'), showCancel: false }) }
function resultLabel(status) { return ({ completed: '已完成', partial: '部分完成', failed: '失败', missed: '已错过', cancelled: '已取消', unconfirmed: '结果未确认' })[status] || status }
function referenceTask(reference) { tasksOpen.value = false; uni.navigateTo({ url: `/pages/agent/index?source=company&from=dashboard&taskReference=${encodeURIComponent(JSON.stringify(reference))}` }) }
function openAgent(source) { uni.navigateTo({ url: `/pages/agent/index?source=${source}&from=dashboard` }) }
function back() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/index/index' }) }) }
onShow(() => {
 visible = true
 try { if (scope && scope !== getAgentStorageScope()) { snapshot.value = null; observationType.value = '' } }
 catch { snapshot.value = null; observationType.value = '' }
 load()
})
function hide() { visible = false; ++requestId; loading.value = false }
onHide(hide); onUnload(hide)
</script>
<style scoped>
.automation-counts { display:flex; gap:28px; margin:8px 0 12px; }.automation-counts > text { font-size:25px; font-weight:600; }.automation-counts > text > text { display:block; font-size:11px; font-weight:400; color:#6e8375; margin-top:2px; }.automation-row { width:100%; min-height:42px; display:flex; align-items:center; justify-content:space-between; gap:14px; text-align:left; }.automation-row > text:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.automation-row > text:last-child { flex-shrink:0; font-size:11px; color:#718677; }.recent-results { margin-top:10px; padding-top:10px; border-top:1px solid #dee6dd; }

view,text,input { font-size:inherit; line-height:inherit; }
.dashboard { height:100vh; display:flex; flex-direction:column; position:relative; overflow:hidden; background:#eef2ee; color:#293f31; font-size:12px; line-height:1.45; }
button { margin:0; padding:0; background:transparent; font-size:inherit; line-height:inherit; } button::after { border:0; }
.nav { flex-shrink:0; background:linear-gradient(#fcfdfb,#eef2ee); }.nav-row { display:flex; align-items:center; box-sizing:border-box; gap:6px; font-weight:650; font-size:14px; }.back { width:42px; height:42px; display:flex; align-items:center; justify-content:center; }
.dashboard-scroll { flex:1; height:0; min-height:0; }.content { padding:15px 18px calc(115px + env(safe-area-inset-bottom)); }
.headline { display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; }.eyebrow { display:block; color:#819082; font-size:8px; letter-spacing:1.8px; }.title { display:block; margin-top:5px; font-size:22px; font-weight:650; letter-spacing:-.6px; }.refresh { width:38px; height:38px; display:flex; align-items:center; justify-content:center; border:1px solid #d9e2d7; border-radius:50%; background:linear-gradient(#f9fbf7,#e8eee5); box-shadow:inset 0 1px 0 #fff; }.refresh[disabled] { opacity:.6; }
.estate { position:relative; height:176px; padding:17px; box-sizing:border-box; overflow:hidden; border-radius:15px; background:radial-gradient(ellipse at 80% 15%,#4d7156,#224c3b 54%,#123729); color:#e4efdc; box-shadow:inset 0 1px 0 #8aa18480,inset 0 -1px 0 #102e25,0 10px 22px -14px #193d2b99; }.estate-grid { position:absolute; inset:0; opacity:.14; background-image:linear-gradient(#b2c6a520 1px,transparent 1px),linear-gradient(90deg,#b2c6a520 1px,transparent 1px); background-size:22px 22px; }.campus { position:absolute; width:210px; height:157px; right:-12px; top:13px; }.estate-top { position:relative; display:flex; align-items:center; gap:6px; color:#b9cfb7; font-size:10px; }.scope-dot { width:4px; height:4px; border-radius:50%; background:#b7ca94; }.estate-number { display:block; position:relative; margin-top:19px; font-size:47px; font-weight:450; line-height:1.1; letter-spacing:-2px; font-variant-numeric:tabular-nums; }.estate-unit { margin-left:5px; font-size:11px; letter-spacing:0; color:#b3c6aa; }.estate-label { display:block; position:relative; margin-top:5px; color:#b3c6aa; font-size:10px; }.estate-foot { position:absolute; left:17px; right:17px; bottom:12px; display:flex; justify-content:space-between; color:#93ad98; font-size:8px; }
.device-strip { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:15px 0; padding:2px 0; }.device-cell { padding-left:15px; border-left:1px solid #d8e1d7; }.device-cell:first-child { padding-left:3px; border:0; }.device-label { display:flex; align-items:center; gap:5px; color:#7a8b7d; font-size:10px; }.device-value { display:block; margin-top:5px; font-size:23px; line-height:1.2; font-weight:550; font-variant-numeric:tabular-nums; }.device-value text { margin-left:4px; color:#8b988b; font-size:9px; }
.panel { margin-top:12px; padding:14px 15px; border-radius:12px; background:linear-gradient(145deg,#fcfdf8,#f3f7ef); border:1px solid #dce5d8; box-shadow:inset 0 1px 0 #fff,0 3px 10px -8px #223d2a44; }.panel-head { display:flex; align-items:center; justify-content:space-between; gap:7px; color:#4c6753; font-size:11px; font-weight:650; }.text-action { display:flex; gap:3px; align-items:center; color:#829386; font-size:9px; min-height:24px; }.sensor-name { display:block; margin-top:6px; color:#91a08f; font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.environment-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; margin:11px 0 8px; }.env-value { display:block; color:#31503a; font-size:24px; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }.env-value text { font-size:11px; margin-left:2px; }.env-label { display:block; margin-top:2px; color:#879782; font-size:9px; }.fineprint { display:block; font-size:9px; line-height:1.5; color:#869780; }
.energy-title { display:flex; align-items:center; gap:7px; }.demo-tag { padding:2px 5px; border:1px solid #e4d9be; border-radius:4px; background:#f4eddc; color:#9a7b40; font-size:8px; font-weight:500; }.mode-switch { display:flex; padding:2px; border-radius:6px; background:#e9efe4; }.mode-switch button { padding:4px 7px; border-radius:4px; color:#8a9987; font-size:9px; }.mode-switch .selected { background:#fcfdf8; color:#477155; box-shadow:0 1px 3px #23422c17; }.energy-top { display:flex; align-items:center; justify-content:space-between; margin-top:9px; }.energy-value { display:block; margin:7px 0; font-size:31px; font-weight:500; letter-spacing:-1px; font-variant-numeric:tabular-nums; }.energy-value text { font-size:11px; color:#809477; margin-left:7px; letter-spacing:0; }.peak { text-align:right; color:#65805c; font-size:10px; }.peak text { display:block; }.peak text:last-child { font-size:8px; color:#8a9a81; margin-top:4px; }.chart { display:block; width:100%; height:77px; }.chart-axis { display:flex; justify-content:space-between; color:#8fa087; font-size:8px; margin:3px 0 7px; }.demo-note { color:#a08a58; }.meter-link { display:flex; align-items:center; justify-content:space-between; width:100%; margin-top:15px; padding-top:11px; border-top:1px solid #e1e8dc; text-align:left; color:#567461; font-size:10px; }
.ledger { display:flex; align-items:center; gap:10px; width:100%; margin-top:13px; padding:12px; box-sizing:border-box; border:1px solid #e2dfca; border-radius:11px; background:linear-gradient(#f8f7ee,#f2f2e5); text-align:left; }.ledger-icon { width:31px; height:31px; flex-shrink:0; border:1px solid #ddd1ae; border-radius:50%; background:radial-gradient(at 35% 25%,#fffbef,#eee5c8); display:flex; align-items:center; justify-content:center; }.ledger-copy { flex:1; min-width:0; }.ledger-copy text { display:block; font-size:11px; font-weight:600; }.ledger-copy text:last-child { margin-top:4px; color:#94917c; font-size:8px; font-weight:400; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.ledger-count { text-align:right; flex-shrink:0; font-size:19px; color:#8a713f; font-variant-numeric:tabular-nums; }.ledger-count text { display:block; }.ledger-count text:last-child { font-size:8px; color:#a09b85; }.ledger-note { display:block; margin:5px 4px 14px; font-size:8px; color:#98a08e; }
.office-gateway { width:100%; display:flex; align-items:center; gap:11px; text-align:left; padding:12px 1px; border-top:1px solid #d8e1d5; transition:transform 140ms cubic-bezier(.23,1,.32,1); }.office-mark { width:36px; height:36px; flex-shrink:0; background:radial-gradient(at 35% 25%,#fcfdf5,#dce5d5); border:1px solid #d3decf; border-radius:10px; display:flex; align-items:center; justify-content:center; }.office-gateway>view:nth-child(2) { flex:1; min-width:0; }.office-gateway text { display:block; font-size:12px; font-weight:600; }.office-gateway text:last-child { margin-top:3px; color:#8b9c86; font-size:9px; font-weight:400; }
.assistant-dock { position:absolute; bottom:0; left:0; right:0; padding:25px 18px calc(12px + env(safe-area-inset-bottom)); background:linear-gradient(#eef2ee00,#eef2ee 35%); pointer-events:none; }.assistant { pointer-events:auto; display:flex; align-items:center; gap:10px; width:100%; padding:12px 15px; box-sizing:border-box; border-radius:14px; background:linear-gradient(150deg,#2f8163,#17563d); color:#edf3df; border:1px solid #215c43; box-shadow:inset 0 1px 0 #a7c5aa70,inset 0 -1px 0 #113d2d,0 9px 20px -10px #17583e80; transition:transform 140ms cubic-bezier(.23,1,.32,1); }.assistant>view:nth-child(2) { flex:1; text-align:left; }.assistant text { display:block; font-size:13px; font-weight:650; }.assistant text:last-child { font-size:9px; color:#b5cbb0; font-weight:400; margin-top:2px; }.assistant-pressed,.gateway-pressed { transform:scale(.98); }
.notice { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; color:#9a784a; font-size:10px; }.notice button { min-height:30px; color:#8b693c; text-decoration:underline; flex-shrink:0; }.observation-scroll { flex:1; height:0; min-height:0; padding:5px 18px 25px; box-sizing:border-box; }.sheet-empty { display:block; margin:45px 0; text-align:center; color:#839189; font-size:13px; }.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; }.assistant,.office-gateway { transition:none; } }
</style>
