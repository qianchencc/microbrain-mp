<template>
  <view class="dashboard">
    <AssistantNav
      title="物联助手"
      back-label="服务首页"
      @back="back"
    >
      <template #title>
        <!-- 具名插槽多根节点在 mp-weixin 会被外包一层普通 view（块级），
        必须收进单一行容器，否则标题与入口竖排 -->
        <view class="title-row">
          <text class="nav-title-text">物联助手</text>
          <view class="nav-sep" />
          <button
            class="office-entry"
            :disabled="Boolean(openingAgent)"
            hover-class="office-entry--pressed"
            aria-label="打开办公室 Agent"
            @tap="openAgent('office')"
            ><text class="office-entry-text">办公室</text
            ><uni-icons
              type="forward"
              size="10"
              color="var(--agent-text-muted)"
          /></button>
        </view>
      </template>
    </AssistantNav>
    <scroll-view
      class="dashboard-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <view class="content">
        <view class="headline">
          <view
            ><text class="page-title">公司总览</text
            ><text class="date">{{ dateLine }} · 公司设备与环境</text></view
          >
          <button
            class="refresh"
            :disabled="loading"
            aria-label="刷新公司概览"
            @tap="load(true)"
            ><uni-icons
              :class="{ spinning: loading }"
              type="refreshempty"
              size="19"
              color="var(--agent-text-secondary)"
          /></button>
        </view>
        <view
          v-if="error"
          class="notice"
          ><text>{{ error }}</text
          ><button @tap="load(true)">重试</button></view
        >
        <view
          v-else-if="snapshot?.errors?.length"
          class="notice"
          ><text>部分观测暂不可用</text><button @tap="showErrors">查看</button></view
        >

        <button
          class="hero"
          hover-class="pressed"
          @tap="openObservation('environment')"
        >
          <text class="hero-label">环境传感器 · 查看趋势 ›</text>
          <text class="hero-temperature"
            >{{ metricValue(environment?.reading?.temp) }}<text class="hero-unit"> °C</text></text
          >
          <text class="hero-meta"
            >湿度 {{ metricValue(environment?.reading?.humidity) }}% · PM2.5
            {{ metricValue(environment?.reading?.pm25) }}</text
          >
          <text
            v-if="envNote || !environment?.reading"
            class="hero-note"
            :class="{ 'status-error': envFailure }"
            >{{
              envNote ||
              (loading ? '正在更新环境读数' : envError ? '环境读数暂不可用' : '暂无环境读数')
            }}</text
          >
          <image
            class="hero-image"
            src="/static/device-art/environment-air-quality-sensor.png"
            mode="aspectFit"
          />
        </button>
        <view class="summary">
          <button
            hover-class="pressed"
            @tap="openCatalog"
            ><text>设备目录</text
            ><text class="summary-value">{{
              devicesLoaded ? catalogDevices.length + ' 台' : devicesError ? '暂不可用' : '读取中'
            }}</text></button
          >
          <button
            hover-class="pressed"
            @tap="openObservation('alerts')"
            ><text>安全台账</text
            ><text class="summary-value">{{ simpleSafety.status }}</text></button
          >
          <button
            hover-class="pressed"
            @tap="openTaskSchedule({ view: 'inbox', date: taskToday(), task: null })"
            ><text>通知中心</text
            ><text class="summary-value">{{ simpleInbox.status }}</text></button
          >
        </view>

        <view class="section"
          ><text>用电观察</text><button @tap="openEnergy()">查看详情 ›</button></view
        >
        <button
          class="energy-card"
          hover-class="pressed"
          @tap="openEnergy()"
          aria-label="查看用电详情"
        >
          <view class="energy-heading"
            ><text>计量日用电</text><text class="energy-value">{{ simpleEnergy.value }}</text
            ><text
              v-if="energyNote"
              :class="{ 'status-error': energyFailure }"
              >{{ energyNote }}</text
            ><text v-else>{{ simpleEnergy.status }}</text></view
          >
          <view
            v-if="energyPreview.length"
            class="energy-bars"
            aria-hidden="true"
          >
            <view
              v-for="day in energyPreview"
              :key="day.date"
              class="energy-bar"
              :class="{ missing: day.missing, latest: day.latest }"
              :style="{ height: day.height + 'px' }"
            />
          </view>
        </button>

        <view class="section"
          ><text>设备目录</text><button @tap="openCatalog">查看全部 ›</button></view
        >
        <scroll-view
          class="device-scroll"
          scroll-x
          enhanced
          :show-scrollbar="false"
        >
          <view class="device-ribbon">
            <button
              v-for="cell in KIND_CELLS"
              :key="cell.kind"
              class="device-card"
              hover-class="pressed"
              @tap="openKind(cell.kind)"
            >
              <image
                :src="cell.art"
                mode="aspectFit"
              /><text class="device-name">{{ cell.label }}</text>
              <text class="device-count">{{
                devicesLoaded
                  ? (kindCounts[cell.kind] ?? 0) + ' 台 · 只读目录'
                  : devicesError
                    ? '暂不可用'
                    : '读取中'
              }}</text>
            </button>
          </view>
        </scroll-view>
        <view class="section"><text>近期任务</text></view>
        <view class="task-card"
          ><CompanyTaskOverview
            :active="pageActive && !tasksOpen"
            :refresh-key="taskRevision"
            @open="openTaskSchedule"
            @unread="syncSimpleUnread"
        /></view>
      </view>
    </scroll-view>
    <TaskListSheet
      v-if="tasksMounted"
      :open="tasksOpen"
      source="company"
      :initial-view="taskEntry.view"
      :date="taskEntry.date"
      :initial-task="taskEntry.task"
      :refresh-key="taskRevision"
      @close="tasksOpen = false"
      @reference="referenceTask"
      @changed="tasksChanged"
      @create="createTask"
    />
    <DeviceSheet
      v-if="observationMounted"
      :open="Boolean(observationType)"
      :back="observationBack"
      tall
      compact-header
      :title="selectedEvent ? '安全台账详情' : observationTitle"
      :subtitle="
        observationType === 'environment'
          ? environmentSite
          : observationType === 'alerts'
            ? '公司授权范围'
            : ''
      "
      @close="observationType = ''"
    >
      <template #header-left
        ><button
          v-if="selectedEvent"
          class="event-back"
          aria-label="返回安全台账"
          hover-class="event-back--pressed"
          @tap="selectedEvent = null"
          ><uni-icons
            type="back"
            size="16"
            color="var(--agent-text-muted)" /></button
      ></template>
      <SafetyHistoryList
        v-if="observationType === 'alerts'"
        class="event-host"
        :style="{ display: selectedEvent ? 'none' : 'flex' }"
        :active="observationType === 'alerts' && !selectedEvent"
        @select="selectedEvent = $event"
      />
      <EnvironmentHistoryView
        v-else-if="observationType === 'environment'"
        class="event-host"
        :active="observationType === 'environment'"
        @question="openEnvironmentAgent"
      />
      <MeterHistoryView
        v-else-if="observationType === 'energy'"
        class="event-host"
        :active="observationType === 'energy'"
        @question="openMeterAgent"
      />
      <scroll-view
        v-else
        class="observation-scroll"
        scroll-y
        enhanced
        :show-scrollbar="false"
        ><ObservationCard
          v-if="observation"
          :observation="observation"
          source="company"
          inline-playback
          read-only
        /><text
          v-else
          class="sheet-empty"
          >暂无可查看的数据</text
        ></scroll-view
      >
      <SafetyEventDetail
        v-if="selectedEvent"
        class="event-host"
        :snapshot="selectedEvent"
        :active="Boolean(observationType)"
        @reference="referenceEvent"
      />
    </DeviceSheet>
    <DeviceSheet
      v-if="energyMounted"
      :open="energyOpen"
      tall
      compact-header
      title="能耗统计"
      @close="energyOpen = false"
    >
      <CompanyEnergySheet
        class="event-host"
        :active="energyOpen"
        :focus-date="energyFocusDate"
      />
    </DeviceSheet>
    <DeviceSheet
      v-if="drawerMounted"
      :open="Boolean(drawerKind)"
      tall
      compact-header
      :title="drawerTitle"
      :meta="drawerDevices.length + ' 台 · 只读目录'"
      @close="drawerKind = ''"
    >
      <CompanyDeviceDrawer
        class="event-host"
        :devices="drawerDevices"
        :kind="drawerKind"
      />
    </DeviceSheet>
    <CompanyAgentFloat
      ref="agentFloat"
      :page-active="pageActive"
      @tasks-changed="tasksChanged"
    />
  </view>
</template>
<script setup>
import { computed, onMounted, reactive, ref, toRefs, watch } from 'vue';
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app';
import {
  pickAgentLaunch,
  savePendingAgentLaunch,
  takePendingAgentLaunch,
} from '@/utils/agent-launch-link.mjs';
import {
  getCompanyDashboard,
  getCompanyDevices,
  clearCompanyReadCache,
  readCompanyDashboardCache,
  writeCompanyDashboardCache,
  getLatestSafetyEvent,
} from '@/apis/agent/observations';
import { getCompanyEnergyDaily } from '@/apis/agent/energy';
import { peekAgentNotifications, readAgentNotifications } from '@/apis/agent/tasks';
import { waitForAgentSession, getAgentStorageScope } from '@/utils/agent-session';
import { useUserStoreHook } from '@/store/modules/user';
import AssistantNav from './components/shared/AssistantNav.vue';
import { backToParent } from './lib/navigation.mjs';
import { shiftDate, shanghaiToday } from './lib/energy.mjs';
import { metricValue, createCompanyOverview } from './lib/dashboard.mjs';
import TaskListSheet from './components/tasks/TaskListSheet.vue';
import CompanyTaskOverview from './components/tasks/CompanyTaskOverview.vue';
import DeviceSheet from './components/shared/DeviceSheet.vue';
import ObservationCard from './components/observations/ObservationCard.vue';
import SafetyEventDetail from './components/observations/SafetyEventDetail.vue';
import SafetyHistoryList from './components/observations/SafetyHistoryList.vue';
import EnvironmentHistoryView from './components/observations/EnvironmentHistoryView.vue';
import MeterHistoryView from './components/observations/MeterHistoryView.vue';
import CompanyEnergySheet from './components/energy/CompanyEnergySheet.vue';
import CompanyDeviceDrawer from './components/shared/CompanyDeviceDrawer.vue';
import CompanyAgentFloat from './components/shared/CompanyAgentFloat.vue';
import {
  parseAgentContext,
  meterHistoryPrompt,
  beginAgentEntry,
  markAgentEntry,
} from './lib/conversation.mjs';
import { environmentHistoryPrompt, environmentWindowReference } from './lib/observations.mjs';
import { taskToday } from './lib/tasks.mjs';

const KIND_CELLS = [
  {
    kind: 'environment',
    label: '环境传感器',
    art: '/static/device-art/environment-air-quality-sensor.png',
  },
  { kind: 'energy', label: '电表', art: '/static/device-art/energy-digital-meter.png' },
  { kind: 'safety', label: '消防安全', art: '/static/device-art/safety-smoke-detector.png' },
  { kind: 'ac', label: '智慧空调', art: '/static/device-art/central-ac-cassette.png' },
  { kind: 'lighting', label: '照明', art: '/static/device-art/lighting-grille-luminaire.png' },
  { kind: 'access', label: '门禁', art: '/static/device-art/access-sliding-door.png' },
  { kind: 'video', label: '视频监控', art: '/static/device-art/video-dome-camera.png' },
];
const WEEKDAYS = '日一二三四五六';

const selectedEvent = ref(null);
const tasksOpen = ref(false),
  taskRevision = ref(0),
  taskEntry = ref({ view: 'schedule', date: '', task: null });
function openTaskSchedule(entry) {
  taskEntry.value = entry;
  tasksOpen.value = true;
}
function createTask() {
  tasksOpen.value = false;
  openCompanyAgent({ prompt: '帮我安排一个任务' });
}
const observationType = ref('');
const overview = createCompanyOverview({
  createState: reactive,
  identity: getAgentStorageScope,
  api: {
    ready: waitForAgentSession,
    dashboard: getCompanyDashboard,
    devices: getCompanyDevices,
    energy: getCompanyEnergyDaily,
    peekUnread: peekAgentNotifications,
    unread: readAgentNotifications,
  },
  cache: {
    read: readCompanyDashboardCache,
    write: writeCompanyDashboardCache,
    clear: clearCompanyReadCache,
  },
  effects: {
    tasksChanged: () => {
      taskRevision.value++;
    },
    reset: () => {
      taskRevision.value++;
      observationType.value = '';
      energyOpen.value = false;
      drawerKind.value = '';
      tasksOpen.value = false;
    },
  },
});
const {
  snapshot,
  loading,
  error,
  energyLoading,
  devicesLoading,
  alertsLoading,
  loadedSections,
  sectionErrors,
  sectionCache,
  catalogDevices,
  devicesLoaded,
  devicesError,
  energyReport,
  energyStrip,
  energyError,
  selectedStripDate,
  simpleUnread,
  simpleUnreadLoaded,
  simpleUnreadError,
} = toRefs(overview.state);
const { load, invalidate: invalidateCompanyDashboard, syncUnread: syncSimpleUnread } = overview;
// 分区失败原因只留错误本体：「正在后台更新/沿用上次数据」这类次级状态不再单列小字，
// pill 上的数值与读取中已自解释；真错误由分区空态/sheet 说明承载。
const sectionNote = (area) =>
  sectionErrors.value[area] || sectionCache.value[area]?.lastError?.message || '';
const sectionFailure = (area) =>
  sectionErrors.value[area] || sectionCache.value[area]?.lastError?.message || '';
const tasksMounted = ref(false),
  observationMounted = ref(false),
  energyMounted = ref(false),
  drawerMounted = ref(false);
watch(
  tasksOpen,
  (open) => {
    if (open) tasksMounted.value = true;
    else void overview.refreshUnread(true);
  },
  { flush: 'sync' }
);
watch(
  observationType,
  (type) => {
    selectedEvent.value = null;
    if (type) observationMounted.value = true;
  },
  { flush: 'sync' }
);

const dateLine = computed(() => {
  const today = shanghaiToday();
  return `${Number(today.slice(5, 7))}月${Number(today.slice(8))}日 · 周${WEEKDAYS[new Date(today + 'T00:00:00Z').getUTCDay()]}`;
});

/* 设备目录计数 + 单类设备抽屉 */
// 设备目录同样按分区保留后端 lastError 与原始 updatedAt；失败不清空已加载目录。
const drawerKind = ref('');
const kindCounts = computed(() => {
  const map = {};
  for (const device of catalogDevices.value) map[device.kind] = (map[device.kind] || 0) + 1;
  return map;
});
// drawerKind 'catalog' 为精简模式的全量目录入口；其余仍是单类设备抽屉。
const drawerDevices = computed(() =>
  drawerKind.value === 'catalog'
    ? catalogDevices.value
    : catalogDevices.value.filter((d) => d.kind === drawerKind.value)
);
const drawerTitle = computed(() =>
  drawerKind.value === 'catalog'
    ? '设备目录'
    : KIND_CELLS.find((c) => c.kind === drawerKind.value)?.label || '设备'
);
watch(
  drawerKind,
  (kind) => {
    if (kind) drawerMounted.value = true;
  },
  { flush: 'sync' }
);
function openKind(kind) {
  if (devicesLoaded.value) drawerKind.value = kind;
}
function openCatalog() {
  if (devicesLoaded.value) drawerKind.value = 'catalog';
}

/* 首页只预览七个计量日；完整历史在能耗面板。 */
const energyOpen = ref(false),
  energyFocusDate = ref('');
watch(
  energyOpen,
  (open) => {
    if (open) energyMounted.value = true;
  },
  { flush: 'sync' }
);
const latestCompleteDay = computed(() => energyReport.value?.latestCompleteDay || '');
const energyPreview = computed(() => {
  const end =
    latestCompleteDay.value || [...energyStrip.value].reverse().find((day) => day.complete)?.date;
  if (!end) return [];
  const byDate = new Map(energyStrip.value.map((day) => [day.date, day]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(end, i - 6),
      day = byDate.get(date);
    const usage =
      day?.complete && typeof day.usage === 'number' && Number.isFinite(day.usage) && day.usage >= 0
        ? day.usage
        : null;
    return { date, usage };
  });
  const max = Math.max(0, ...days.map((day) => day.usage ?? 0));
  return days.map((day, i) => ({
    date: day.date,
    missing: day.usage == null,
    latest: i === 6 && day.usage != null,
    height: day.usage == null ? 3 : max ? Math.max(3, Math.round((day.usage / max) * 38)) : 3,
  }));
});
// 后端 stale 的 lastError 与本次刷新失败分开保留：两者都不能清掉已有日柱，
// 也不用前端时间重新标记为 fresh。
const energyFailure = computed(
  () =>
    sectionErrors.value.energyDaily ||
    energyError.value ||
    sectionCache.value.energyDaily?.lastError?.message ||
    ''
);
const energyNote = computed(() => sectionNote('energyDaily') || energyError.value);
function openEnergy(date) {
  energyFocusDate.value = date || latestCompleteDay.value || '';
  if (date) selectedStripDate.value = date;
  energyOpen.value = true;
}
/* 环境 / 台账 / 自动化 */
const environment = computed(
  () => snapshot.value?.environment?.find((row) => row.reading) || snapshot.value?.environment?.[0]
);
// 有旧数据时刷新失败只提示、不隐藏台账；仅在没有可用台账时才显示不可用。
const alertsUnavailable = computed(
  () =>
    !snapshot.value?.alerts &&
    (Boolean(sectionErrors.value.alerts) ||
      Boolean(snapshot.value?.errors?.some((row) => row.area === 'alerts')))
);

// Notification and section lifetimes are owned together by the overview module.
const envNote = computed(() => sectionNote('environment'));
const envFailure = computed(() => sectionFailure('environment'));
const envError = computed(
  () =>
    !environment.value?.reading &&
    Boolean(envFailure.value || snapshot.value?.errors?.some((row) => row.area === 'environment'))
);
const simpleEnergy = computed(() => {
  if (energyError.value && !energyReport.value)
    return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' };
  const usable = [...(energyReport.value?.days || [])].reverse().filter((day) => day.usage != null);
  const latest = usable.find((day) => day.complete);
  if (!latest)
    return energyLoading.value
      ? { warn: false, pill: '读取中', status: '更新中', value: '—' }
      : { warn: false, pill: '正常', status: '暂无数据', value: '—' };
  const prev = usable.find((day) => day !== latest && day.complete && day.date < latest.date);
  const delta = prev?.usage ? Math.round(((latest.usage - prev.usage) / prev.usage) * 100) : null;
  const unit = energyReport.value?.basis?.unit === 'kWh' ? ' 度' : '';
  const dayText =
    latest.date === shiftDate(shanghaiToday(), -1)
      ? '昨日'
      : `${Number(latest.date.slice(5, 7))}月${Number(latest.date.slice(8))}日`;
  const high = delta != null && delta > 10;
  const stale = Boolean(energyFailure.value);
  return {
    warn: high || stale,
    pill: stale ? '沿用' : high ? '注意' : '正常',
    status: high ? '偏高' : '平稳',
    value: `${dayText} ${Number(latest.usage).toLocaleString()}${unit}${delta != null ? ` ${delta >= 0 ? '↑' : '↓'}${Math.abs(delta)}%` : ''}`,
  };
});
const simpleSafety = computed(() => {
  if (alertsUnavailable.value) return { status: '暂不可用' };
  if (!loadedSections.value.includes('alerts')) return { status: '读取中' };
  const alerts = snapshot.value?.alerts;
  if (Number.isFinite(alerts?.total)) return { status: `${alerts.total} 条记录` };
  return { status: alerts?.records?.length ? '有历史记录' : '暂无记录' };
});
const simpleInbox = computed(() => {
  if (!simpleUnreadLoaded.value)
    return { warn: false, pill: '读取中', status: '更新中', value: '任务与报告' };
  if (simpleUnreadError.value)
    return { warn: true, pill: '暂不可用', status: '读取失败', value: '任务与报告' };
  if (simpleUnread.value > 0)
    return {
      warn: true,
      pill: '待查看',
      status: `${simpleUnread.value > 99 ? '99+' : simpleUnread.value} 条未读`,
      value: '任务与报告',
    };
  return { warn: false, pill: '正常', status: '无未读', value: '任务与报告' };
});
const observationTitle = computed(
  () =>
    ({ environment: '环境历史趋势', energy: '电表统计', alerts: '安全事件台账' })[
      observationType.value
    ] || ''
);
const environmentSite = computed(
  () => environment.value?.location || environment.value?.name || ''
);
const observation = computed(() => {
  if (
    !snapshot.value ||
    !observationType.value ||
    (observationType.value === 'alerts' && alertsUnavailable.value)
  )
    return null;
  const type = observationType.value;
  return {
    observedAt: snapshot.value[type + 'ObservedAt'],
    blocks: [
      type === 'alerts'
        ? { type, ...snapshot.value.alerts }
        : { type, devices: snapshot.value[type] || [] },
    ],
  };
});

const dashboardUser = useUserStoreHook();
let visible = false;
watch(
  () => [dashboardUser.token, dashboardUser.getDistrict?.id, dashboardUser.authorized],
  () => {
    void overview.identityChanged();
  }
);
function openObservation(type) {
  if (['alerts', 'environment', 'energy'].includes(type) || snapshot.value)
    observationType.value = type;
}
function showErrors() {
  uni.showModal({
    title: '部分数据暂不可用',
    content: snapshot.value.errors.map((row) => row.message).join('\n'),
    showCancel: false,
  });
}
function observationBack() {
  if (selectedEvent.value) selectedEvent.value = null;
  else observationType.value = '';
}
/* 公司 Agent 改为右下角浮层（CompanyAgentFloat），办公室 Agent 仍走独立页面。
   引用/观察窗口直传浮层对象，不再过 URL。 */
const agentFloat = ref(null);
const openingAgent = ref('');
const pageActive = ref(false);
let pendingAgentOpen = null,
  latestAlertRequest = 0,
  latestAlertLoading = false;
function openCompanyAgent(payload = {}) {
  agentFloat.value?.open(payload);
}
function referenceEvent(reference) {
  selectedEvent.value = null;
  observationType.value = '';
  openCompanyAgent({ reference });
}
function referenceTask(reference) {
  tasksOpen.value = false;
  openCompanyAgent({ reference });
}
function tasksChanged() {
  taskRevision.value++;
  invalidateCompanyDashboard();
}
function openEnvironmentAgent(window) {
  const reference = environmentWindowReference(window);
  if (!reference) return;
  observationType.value = '';
  openCompanyAgent({ reference, prompt: environmentHistoryPrompt(window) });
}
function openMeterAgent(window) {
  observationType.value = '';
  openCompanyAgent({ prompt: meterHistoryPrompt(window) });
}
function openAgent(source) {
  if (openingAgent.value) return;
  openingAgent.value = source;
  beginAgentEntry(source);
  markAgentEntry(source, 'navigate');
  uni.navigateTo({
    url: `/pages/agent/index?source=${source}&from=dashboard`,
    fail: () => {
      openingAgent.value = '';
      uni.showToast({ title: '未能打开，请重试', icon: 'none' });
    },
  });
}
// 卡片/深链参数在 onLoad 只写入暂存；真正的消费点只有 onShow（App 的登录恢复、
// 后台热启动都写同一个槽），避免两条路径各开一次浮层。
async function openPendingAgentLaunch() {
  if (!pendingAgentOpen || !agentFloat.value) return;
  const query = pendingAgentOpen;
  pendingAgentOpen = null;
  const current = ++latestAlertRequest;
  if (latestAlertLoading) {
    latestAlertLoading = false;
    uni.hideLoading();
  }
  if (query.entry !== 'latest-alert') {
    agentFloat.value.open(parseAgentContext(query));
    return;
  }
  const names = { gas: '燃气', smoke: '烟感', water: '水浸' };
  if (
    !['gas', 'smoke', 'water'].includes(query.type) ||
    (query.deviceId !== undefined &&
      (typeof query.deviceId !== 'string' || !query.deviceId.trim() || query.deviceId.length > 300))
  ) {
    uni.showToast({ title: '告警入口的类型或设备标识无效', icon: 'none' });
    return;
  }
  let identity;
  const isActive = () =>
    visible &&
    pageActive.value &&
    agentFloat.value?.isOpen !== false &&
    current === latestAlertRequest &&
    identity === getAgentStorageScope();
  try {
    await waitForAgentSession();
    if (!visible || current !== latestAlertRequest) return;
    identity = getAgentStorageScope();
    await agentFloat.value.open();
    latestAlertLoading = true;
    uni.showLoading({ title: `读取最新${names[query.type]}告警`, mask: false });
    const result = await getLatestSafetyEvent(
      { type: query.type, deviceId: query.deviceId, to: new Date().toISOString() },
      { isActive }
    );
    if (!isActive()) return;
    if (!result.record || !result.reference) {
      uni.showModal({
        title: `没有可引用的${names[query.type]}告警`,
        content: '指定范围内未查到告警记录，不会改用其他设备或告警类型。',
        showCancel: false,
      });
      return;
    }
    agentFloat.value.open({
      reference: result.reference,
      prompt: `请帮我核实这条${names[query.type]}告警，并给出处置建议。`,
    });
  } catch (error) {
    if (current !== latestAlertRequest || !visible || error.code === 'AGENT_READ_INVALIDATED')
      return;
    uni.showModal({
      title: '告警读取未完成',
      content: error.message || '请稍后重试，不会改用其他设备或告警类型。',
      confirmText: '重试',
      cancelText: '留在助手',
      success: (value) => {
        if (value.confirm && identity && isActive()) {
          pendingAgentOpen = query;
          void openPendingAgentLaunch();
        }
      },
    });
  } finally {
    if (current === latestAlertRequest && latestAlertLoading) {
      latestAlertLoading = false;
      uni.hideLoading();
    }
  }
}
onLoad((options) => {
  const launch = pickAgentLaunch('pages/agent/dashboard', options || {});
  if (launch) savePendingAgentLaunch(launch);
});
onMounted(openPendingAgentLaunch);
function back() {
  backToParent('/pages/index/index');
}
onShow(() => {
  visible = true;
  pageActive.value = true;
  openingAgent.value = '';
  const pending = takePendingAgentLaunch();
  if (pending) pendingAgentOpen = pending.query;
  void overview.show();
  openPendingAgentLaunch();
});
function hide() {
  visible = false;
  pageActive.value = false;
  ++latestAlertRequest;
  overview.hide();
  if (latestAlertLoading) {
    latestAlertLoading = false;
    uni.hideLoading();
  }
}
onHide(hide);
onUnload(hide);
</script>
<style scoped lang="scss">
@import './styles/tokens';
.event-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.event-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}
.event-back--pressed {
  opacity: 0.65;
}

view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.dashboard {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: $agent-color-surface-page;
  color: $agent-color-text-primary;
  font-size: $agent-font-size-compact;
  line-height: 1.45;
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  font-size: inherit;
  line-height: inherit;
}
button::after {
  border: 0;
}
.dashboard-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}
.content {
  padding: 15px 15px calc(40px + env(safe-area-inset-bottom));
}
.headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  display: block;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.date {
  display: block;
  margin-top: 2px;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.refresh {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  flex-shrink: 0;
}
.refresh[disabled] {
  opacity: 0.6;
}
.hero {
  position: relative;
  display: block;
  width: 100%;
  min-height: 178px;
  box-sizing: border-box;
  padding: 19px;
  text-align: left;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(130deg, $agent-color-tint, $agent-color-surface);
}
.hero-label,
.hero-temperature,
.hero-meta,
.hero-note {
  display: block;
  position: relative;
  z-index: 1;
  max-width: 66%;
}
.hero-label {
  color: $agent-color-text-secondary;
  font-size: 11px;
}
.hero-temperature {
  margin-top: 10px;
  color: $agent-color-accent-deep;
  font-size: 45px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -2px;
}
.hero-unit {
  font-size: 16px;
  letter-spacing: 0;
}
.hero-meta,
.hero-note {
  color: $agent-color-text-muted;
  font-size: 11px;
}
.hero-note {
  margin-top: 4px;
}
.hero-image {
  position: absolute;
  width: 116px;
  height: 116px;
  right: 9px;
  top: 31px;
}
.summary {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.summary button {
  flex: 1;
  min-width: 0;
  padding: 12px;
  text-align: left;
  background: #fff;
  border-radius: 15px;
}
.summary button text {
  display: block;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.summary button .summary-value {
  margin-top: 4px;
  color: $agent-color-text-secondary;
  font-size: 15px;
  font-weight: 700;
}
.section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 19px 2px 9px;
  font-size: 15px;
  font-weight: 700;
}
.section button {
  min-height: 36px;
  color: $agent-color-text-secondary;
  font-size: 11px;
  font-weight: 400;
}
.energy-card {
  display: flex;
  align-items: flex-end;
  gap: 15px;
  width: 100%;
  box-sizing: border-box;
  padding: 15px;
  text-align: left;
  background: $agent-color-accent-faint;
  border-radius: 18px;
}
.energy-heading {
  flex: 1;
  min-width: 0;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.energy-heading text {
  display: block;
}
.energy-heading .energy-value {
  color: $agent-color-accent;
  font-size: 21px;
  font-weight: 700;
  margin: 4px 0;
}
.energy-bars {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 38px;
}
.energy-bar {
  width: 8px;
  border-radius: 4px 4px 0 0;
  background: $agent-color-chart;
}
.energy-bar.latest {
  background: $agent-color-chart-deep;
}
.energy-bar.missing {
  background: $agent-color-tint;
}

.status-error {
  color: $agent-color-warning;
}
.device-scroll {
  width: 100%;
  white-space: nowrap;
}
.device-ribbon {
  display: flex;
  gap: 9px;
  padding: 1px 0 6px;
}
.device-card {
  flex: 0 0 112px;
  box-sizing: border-box;
  padding: 11px;
  text-align: left;
  background: #fff;
  border-radius: 18px;
}
.device-card image {
  display: block;
  width: 100%;
  height: 64px;
}
.device-name,
.device-count {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-name {
  margin-top: 7px;
  font-weight: 600;
}
.device-count {
  margin-top: 3px;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.task-card {
  padding: 14px;
  background: #fff;
  border-radius: 18px;
}

/* 标题旁办公室入口：细分隔线 + 次要色文字链接（AssistantNav #title 插槽内容用本文件样式）。
   具名插槽会被 uni-app 包一层 <view slot="title">（普通块级、无 data-v，
   scoped 命中不到它）——内容必须收进单一 flex 行容器自保横排。 */
.title-row {
  display: flex;
  align-items: center;
}
.nav-title-text {
  font-size: 15px;
  font-weight: 600;
  color: $agent-color-text-primary;
}
.nav-sep {
  width: 1px;
  height: 13px;
  margin: 0 11px;
  flex-shrink: 0;
  background: rgba(var(--agent-shadow-rgb), 0.16);
}
.office-entry {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 8px 0;
}
.office-entry::after {
  border: 0;
}
.office-entry[disabled] {
  opacity: 0.6;
}
.office-entry--pressed {
  opacity: 0.65;
}
.office-entry-text {
  font-size: 12.5px;
  color: $agent-color-text-muted;
}
.pressed {
  opacity: 0.65;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  color: $agent-color-warning-deep;
  font-size: 10px;
}
.notice button {
  min-height: 30px;
  color: $agent-color-warning-deep;
  text-decoration: underline;
  flex-shrink: 0;
}
.observation-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 5px 18px 25px;
  box-sizing: border-box;
}
.sheet-empty {
  display: block;
  margin: 45px 0;
  text-align: center;
  color: $agent-color-text-muted;
  font-size: 13px;
}
.spinning {
  animation: spin 900ms linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
