<template>
  <DeviceSheet
    :open="open"
    :open-request="openRequest"
    :title="sheetTitle"
    :meta="sheetMeta"
    :subtitle="sheetSubtitle"
    :tall="browser"
    :busy="busy"
    :before-close="allowDiscard"
    :back="backWithinSheet"
    @close="emit('close')"
  >
    <template
      v-if="browser || current"
      #header-right
    >
      <view class="header-actions">
        <button
          class="title-state-refresh"
          aria-label="刷新设备状态"
          :disabled="!open || busy || stateLoading"
          @tap="stateRefresh.run()"
          ><uni-icons
            :class="{ spinning: stateLoading }"
            type="refreshempty"
            size="16"
            color="var(--agent-text-secondary)"
        /></button>
        <button
          v-if="browser && page !== 2 && dirty"
          class="title-restore"
          :disabled="busy"
          hover-class="title-restore--pressed"
          @tap="emit('restore')"
          >还原</button
        >
        <button
          v-if="browser && page !== 2"
          class="title-select-all"
          :disabled="busy || !pending"
          hover-class="title-select-all--pressed"
          @tap="toggleAll"
          >{{ allSelected ? '取消全选' : '全选' }}</button
        >
      </view>
    </template>
    <view
      v-if="browser"
      class="pages"
      :class="{ editing: page === 2 }"
    >
      <view class="surface devices-surface">
        <view
          class="header-viewport"
          :class="{ searching: page === 1 }"
        >
          <view class="controls">
            <view class="chip-flow">
              <button
                v-for="(mode, index) in groupModes"
                :key="mode.by"
                class="chip"
                :class="{ active: index === groupIndex }"
                hover-class="chip--pressed"
                @tap="selectGroup(index)"
                ><text>{{ mode.label }}</text></button
              >
              <button
                class="search-toggle"
                aria-label="搜索设备"
                hover-class="search-toggle--pressed"
                :hover-stay-time="60"
                @tap="openSearch"
                ><image
                  class="search-toggle-icon"
                  src="/static/search.svg"
              /></button>
            </view>
          </view>
          <view
            v-if="searchMounted"
            class="search-controls"
          >
            <button
              class="search-back"
              aria-label="返回全部设备"
              hover-class="search-back--pressed"
              :hover-stay-time="60"
              @tap="closeSearch"
              ><image
                class="back-icon"
                src="/static/back.svg"
            /></button>
            <view class="search-field"
              ><image
                class="search-field-icon"
                src="/static/search.svg" /><input
                v-model="search"
                class="search-input"
                placeholder="搜索设备名称或位置"
                placeholder-style="color:var(--agent-text-muted)"
                confirm-type="search"
                :focus="searchFocused"
                :adjust-position="false"
            /></view>
          </view>
        </view>
        <text
          v-if="stateError || stateObservationLabel(stateSnapshot)"
          class="note"
          >{{ stateError || stateObservationLabel(stateSnapshot) }}</text
        >
        <view class="device-scroll-shell"
          ><scroll-view
            scroll-y
            enhanced
            :show-scrollbar="false"
            class="device-list"
            :scroll-top="scrollCtrl"
            scroll-with-animation
            @scroll="onListScroll"
            ><view
              v-for="group in groups"
              :key="group.key"
              class="group"
              :style="{ width: grid.trackWidth + 'px' }"
              ><text class="group-title">{{ group.label }} · {{ group.items.length }}</text
              ><view class="grid"
                ><DeviceActionCard
                  v-for="item in group.items"
                  :key="item.action.id"
                  :action="item.action"
                  :index="item.index"
                  :selected="selected.includes(item.action.id)"
                  :readonly="!pending"
                  :disabled="busy"
                  :phase="phase(item.action)"
                  :current-state="states[item.action.deviceId] ?? null"
                  :operation="operationLabel(item.action)"
                  :outcome-label="outcome(item.action)"
                  :highlight="search"
                  @toggle="toggle(item.action.id)"
                  @configure="configure(item.action)" /></view></view
            ><text
              v-if="!groups.length"
              class="note"
              >没有匹配的设备</text
            ><view class="list-tail" /></scroll-view
          ><view
            class="scroll-fade"
            :class="{ off: !remainingBelow }"
          /><view
            class="cue-float"
            :class="{ off: !remainingBelow }"
            role="button"
            hover-class="cue-float--pressed"
            @tap="scrollNext"
            ><image
              class="cue-icon"
              src="/static/chevron-down.svg"
            /><text class="cue-text">还有 {{ remainingBelow }} 台设备</text></view
          ></view
        >
        <view class="confirm-float"
          ><view
            v-if="error"
            class="confirm-error"
            ><text>{{ error }}</text
            ><button @tap="emit('reconnect')">重新读取</button></view
          ><button
            v-if="pending"
            class="confirm-btn"
            :disabled="busy || !pending || !selected.length"
            hover-class="confirm-btn--pressed"
            @tap="emit('confirm')"
            ><text class="confirm-btn-text">确认草案 · {{ selected.length }}</text></button
          ><text
            v-if="!pending && !error && notice"
            class="confirm-caption"
            >{{
              notice.kind === 'executing' ? '正在执行，可以关闭面板后查看结果' : notice.text
            }}</text
          ><text
            v-else-if="pending"
            class="confirm-caption"
            >已选择 {{ selected.length }} 台设备</text
          ></view
        >
      </view>
      <view class="surface editor-surface">
        <button
          v-if="current"
          class="back"
          hover-class="back--pressed"
          @tap="backFromEditor"
          ><image
            class="back-icon"
            src="/static/back.svg"
          /><text>{{ editorBack === 1 ? '返回搜索结果' : '返回全部设备' }}</text></button
        >
        <view
          v-if="current && !pending"
          class="stale-note"
          ><text>{{ staleText }}</text
          ><button
            v-if="renderDraft.status === 'EXPIRED'"
            class="stale-revalidate"
            :disabled="busy"
            hover-class="stale-revalidate--pressed"
            @tap="emit('revalidate')"
            >重新核验</button
          ></view
        >
        <ParameterEditor
          ref="parameterEditor"
          @dirty="editorDirty = $event"
          v-if="current && pending"
          embedded
          :key="current.id"
          :action="current"
          :actions="renderDraft.actions"
          :states="states"
          :busy="busy"
          :error="parameterError"
          @save="save"
        />
      </view>
    </view>
    <ParameterEditor
      ref="parameterEditor"
      @dirty="editorDirty = $event"
      v-else-if="current"
      :key="current.id"
      :action="current"
      :actions="renderDraft.actions"
      :states="states"
      :busy="busy"
      :error="parameterError"
      @save="save"
    />
  </DeviceSheet>
</template>
<script setup>
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { readDeviceStates, updateParameters } from '@/apis/agent/actions';
import { showAgentError } from '@/utils/agent-error';
import { useViewReads } from '../../lib/reads.mjs';
import {
  operationLabel,
  receiptPhase,
  createStateRefresh,
  computeDeviceGrid,
  createDraftGroups,
  draftBaselineChanged,
  firstRowBelowFold,
  remainingBelowFold,
  createViewportMeasurer,
  executionNotice,
} from '../../lib/actions.mjs';
import { receiptText } from '../../lib/conversation.mjs';
import { stateObservationLabel } from '../../lib/observations.mjs';
import DeviceActionCard from './DeviceActionCard.vue';
import DeviceSheet from '../shared/DeviceSheet.vue';
import ParameterEditor from './ParameterEditor.vue';
const props = defineProps({
  source: { type: String, default: 'office' },
  draft: { type: Object, default: null },
  result: { type: Object, default: null },
  baseline: { type: Object, default: null },
  browser: Boolean,
  currentActionId: { type: String, default: '' },
  openRequest: { type: Number, default: 0 },
  error: String,
  busy: Boolean,
  settleSelection: { type: Function, default: null },
});
const emit = defineEmits([
  'close',
  'select',
  'confirm',
  'updated',
  'editing',
  'revalidate',
  'restore',
  'reconnect',
]);
const initialWindowWidth =
  uni.getWindowInfo?.().windowWidth || uni.getSystemInfoSync().windowWidth || 320;
const stateSnapshot = ref(null),
  stateError = ref(''),
  stateLoading = ref(false),
  page = ref(0),
  search = ref(''),
  searchMounted = ref(false),
  searchFocused = ref(false),
  groupIndex = ref(0),
  parameterError = ref(''),
  windowWidth = ref(initialWindowWidth);
const states = computed(() => stateSnapshot.value?.states || {});
const parameterEditor = ref(null),
  editorDirty = ref(false);
function allowDiscard() {
  if (props.busy && editorDirty.value) {
    uni.showToast({ title: '正在保存，请稍候', icon: 'none' });
    return Promise.resolve(false);
  }
  if (!editorDirty.value) return Promise.resolve(true);
  return new Promise((resolve) =>
    uni.showModal({
      title: '放弃未保存的修改？',
      content: '这些调整尚未保存到草案。',
      confirmText: '放弃修改',
      cancelText: '继续编辑',
      success: (result) => {
        if (result.confirm) {
          parameterEditor.value?.discard();
          editorDirty.value = false;
        }
        resolve(Boolean(result.confirm));
      },
      fail: () => resolve(false),
    })
  );
}
async function backFromEditor() {
  if (await allowDiscard()) {
    parameterEditor.value?.discard();
    page.value = editorBack.value;
  }
}
async function backWithinSheet() {
  if (props.browser && page.value === 2) await backFromEditor();
  else if (props.browser && page.value === 1) closeSearch();
  else if (await allowDiscard()) emit('close');
}
const currentId = ref(''),
  editorBack = ref(0);
let searchTimer;
const groupModes = [
  { label: '区域', by: 'location' },
  { label: '类型', by: 'kind' },
  { label: '选择', by: 'selection' },
];
const grid = computed(() => computeDeviceGrid(windowWidth.value));
function selectGroup(index) {
  groupIndex.value = index;
}
const open = computed(() => Boolean(props.draft));
const reads = useViewReads(
  () => open.value,
  () => [props.source, props.draft?.draftId]
);
// 关闭动画期间冻结渲染：emit('close') 同帧父级就清空 draftId，但 sheet 仍需完成退场过渡。
// 渲染一律读最后一次非空的草案/回执/基线快照，否则标题与编辑器会在退场开始前卸载——「瞬间消失+一闪」。
const renderDraft = ref(null),
  renderResult = ref(null),
  renderBaseline = ref(null);
// 换草案时三个快照同步切换（新轮次的回执/基线可能为 null，须覆盖旧值防串稿）；
// draft→null 的关闭路径刻意跳过，让快照留到收起动画播完。
watch(
  () => props.draft,
  (value) => {
    if (!value) return;
    renderDraft.value = value;
    renderResult.value = props.result;
    renderBaseline.value = props.baseline;
  },
  { immediate: true }
);
watch(
  () => props.baseline,
  (value) => {
    if (value) renderBaseline.value = value;
  },
  { immediate: true }
);
const pending = computed(() => renderDraft.value?.status === 'PENDING_CONFIRMATION');
const staleText = computed(
  () =>
    ({
      EXPIRED: '核验已过期，未执行。重新核验后可继续调整。',
      CANCELLED: '操作已取消，未执行。发送新指令可重新下达。',
      INTERRUPTED: '执行中断，部分指令可能已下发，以设备实际状态为准。',
    })[renderDraft.value?.status] || ''
);
// 底部说明与面板同一事实来源：执行中只认 EXECUTING，终态文案真实兜底，不虚构「已更新」。
const notice = computed(() => executionNotice(renderDraft.value, renderResult.value));
const selected = computed(() => renderDraft.value?.selectedActionIds || []);
const allSelected = computed(
  () =>
    Boolean(renderDraft.value?.actions.length) &&
    selected.value.length === renderDraft.value.actions.length
);
// 「还原」仅在有改动时出现：草案与发布基线一致时它是纯噪声；过期/终态只读不显示。
const dirty = computed(
  () => pending.value && draftBaselineChanged(renderDraft.value, renderBaseline.value)
);
const current = computed(
  () => renderDraft.value?.actions.find((action) => action.id === currentId.value) ?? null
);
const browserEditor = computed(() => props.browser && page.value === 2);
const sheetTitle = computed(() =>
  browserEditor.value ? '空调调节' : props.browser ? '全部设备' : '空调调节'
);
const sheetMeta = computed(() =>
  props.browser && !browserEditor.value ? `${renderDraft.value?.actions.length || 0} 台设备` : ''
);
const sheetSubtitle = computed(() =>
  browserEditor.value || !props.browser ? current.value?.deviceName || '' : ''
);
const kindSearchNames = { lighting: '照明 灯 灯具', ac: '空调 中央空调', access: '门禁 电动门 门' };
const filteredActions = computed(() => {
  if (!renderDraft.value) return [];
  const query = search.value.trim().toLocaleLowerCase();
  if (!query) return renderDraft.value.actions;
  return renderDraft.value.actions.filter((action) =>
    [action.deviceName, action.location, kindSearchNames[action.kind], action.kind]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
  );
});
const groups = computed(() =>
  createDraftGroups(filteredActions.value, selected.value, {
    groupBy: groupModes[groupIndex.value].by,
  })
);
// 滚动浮标：scrollY 由 @scroll 逐帧同步，remaining 用确定性几何纯算（行距 192），不在回调里查 DOM。
const scrollY = ref(0),
  scrollCtrl = ref(0),
  listViewportH = ref(0);
const remainingBelow = computed(() =>
  remainingBelowFold(groups.value, grid.value.columns, scrollY.value, listViewportH.value)
);
function onListScroll(event) {
  scrollY.value = event?.detail?.scrollTop ?? scrollY.value;
}
function scrollNext() {
  const top = firstRowBelowFold(
    groups.value,
    grid.value.columns,
    scrollY.value,
    listViewportH.value
  );
  if (top != null) scrollCtrl.value = Math.max(0, top - 8);
}
const instance = getCurrentInstance();
// 面板内容首次打开或重排时可能尚未完成布局；单次测量会拿到空 rect 让浮标计数恒为 0。
// 打开/resize 时做有界重试直到量到非零高度。
const listMeasurer = createViewportMeasurer({
  query: (cb) =>
    uni
      .createSelectorQuery()
      .in(instance?.proxy)
      .select('.device-list')
      .boundingClientRect(cb)
      .exec(),
  apply: (height) => {
    listViewportH.value = height;
  },
  active: () => open.value && props.browser,
});
watch(
  () => props.currentActionId,
  (value) => {
    currentId.value = value;
  },
  { immediate: true }
);
// 每次显式打开（openRequest 递增）或换到新草案时回到列表页并清搜索；关闭（draft→null）不重置，
// 否则退场动画期间 surface 会中途滑位。同一草案重开也经 openRequest 覆盖到。
watch(
  () => [props.draft?.draftId, props.openRequest],
  () => {
    if (!props.draft) return;
    reads.invalidate();
    stateSnapshot.value = null;
    stateError.value = '';
    page.value = 0;
    search.value = '';
    searchMounted.value = false;
    searchFocused.value = false;
    groupIndex.value = 0;
    parameterError.value = '';
    editorDirty.value = false;
    parameterEditor.value?.discard();
    if (props.browser) listMeasurer.schedule();
    if (open.value) void stateRefresh.run();
  }
);
// 面板内三页导航：0 全部设备 / 1 搜索 / 2 参数编辑；返回列表页即清过滤，列表始终是全量。
watch(page, (value) => {
  if (value === 0) search.value = '';
});
watch(open, (value) => {
  if (value) {
    stateRefresh.auto();
    scrollY.value = 0;
    if (props.browser) listMeasurer.schedule();
  } else {
    stateRefresh.cancel();
    reads.invalidate();
    stateLoading.value = false;
  }
});
watch(
  () => props.result,
  (result) => {
    if (result) renderResult.value = result;
    if (result && open.value) {
      reads.invalidate();
      stateSnapshot.value = null;
      stateError.value = '';
      stateRefresh.after(1000);
    }
  }
);
function updateWindowWidth(event) {
  windowWidth.value =
    event?.size?.windowWidth ||
    event?.windowWidth ||
    uni.getWindowInfo?.().windowWidth ||
    windowWidth.value;
  listMeasurer.schedule();
}
onMounted(() => uni.onWindowResize?.(updateWindowWidth));
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  stateRefresh.cancel();
  reads.invalidate();
  listMeasurer.dispose();
  uni.offWindowResize?.(updateWindowWidth);
});
// 交互动作以 open 为门：收起动画那 300ms 里渲染快照仍非空，但面板已关，不允许再发操作。
function toggle(id) {
  if (!open.value || !pending.value || props.busy) return;
  emit(
    'select',
    selected.value.includes(id)
      ? selected.value.filter((item) => item !== id)
      : [...selected.value, id]
  );
}
function toggleAll() {
  if (!open.value || !pending.value || props.busy) return;
  emit('select', allSelected.value ? [] : renderDraft.value.actions.map((action) => action.id));
}
function openSearch() {
  clearTimeout(searchTimer);
  searchMounted.value = true;
  page.value = 1;
  nextTick(() => {
    if (open.value && page.value === 1) searchFocused.value = true;
  });
}
function closeSearch() {
  clearTimeout(searchTimer);
  searchFocused.value = false;
  page.value = 0;
  searchTimer = setTimeout(() => {
    searchMounted.value = false;
  }, 280);
}
// 参数编辑页只服务空调：门禁无参数可配（一次执行即开一次门），卡片侧已不 emit configure，这里兜底拦截
function configure(action) {
  if (!open.value || props.busy || !pending.value || action.kind !== 'ac') return;
  currentId.value = action.id;
  parameterError.value = '';
  editorDirty.value = false;
  parameterEditor.value?.discard();
  if (props.browser) {
    editorBack.value = page.value;
    page.value = 2;
  }
}
function receipt(action) {
  return renderResult.value?.receipts?.find((item) => item.actionId === action.id);
}
function outcome(action) {
  return receiptText(receipt(action));
}
function phase(action) {
  if (renderResult.value)
    return receiptPhase(
      action,
      receipt(action)?.outcome ??
        (selected.value.includes(action.id) ? renderResult.value.status : 'UNSELECTED'),
      renderResult.value.readback?.[action.id]
    );
  return renderDraft.value?.status === 'CANCELLED'
    ? 'cancelled'
    : renderDraft.value?.status === 'EXPIRED'
      ? 'expired'
      : 'pending';
}
async function refresh() {
  if (!props.draft) return;
  await reads.run(
    'states',
    (options) => readDeviceStates(props.draft.draftId, props.source, options),
    {
      start: () => {
        stateLoading.value = true;
        stateError.value = '';
      },
      data: (snapshot) => {
        stateSnapshot.value = snapshot;
      },
      denied: () => {
        stateSnapshot.value = null;
      },
      error: (cause) => {
        stateSnapshot.value = null;
        stateError.value = cause.message || '设备状态读取失败';
      },
      finish: () => {
        stateLoading.value = false;
      },
    }
  );
}
const stateRefresh = createStateRefresh(refresh);
watch(reads.isActive, (active) => {
  if (active) stateRefresh.auto();
  else {
    stateRefresh.cancel();
    stateLoading.value = false;
  }
});
async function save(changes) {
  if (!open.value || props.busy || !pending.value) return;
  emit('editing', true);
  parameterError.value = '';
  // 点选同步是异步串行的：先等它落地再取 revision，避免 409
  try {
    await props.settleSelection?.(props.draft.draftId);
    const updated = await updateParameters(
      props.draft.draftId,
      props.draft.revision,
      changes,
      props.source
    );
    emit('updated', updated);
    parameterEditor.value?.discard();
    editorDirty.value = false;
    if (props.browser) page.value = editorBack.value;
    else emit('close');
  } catch (cause) {
    parameterError.value = '保存失败，修改仍保留';
    showAgentError(cause, { fallback: '保存失败，请重试' });
  } finally {
    emit('editing', false);
  }
}
</script>
<style scoped>
/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.confirm-error {
  pointer-events: auto;
  color: var(--agent-error);
  font-size: 12px;
  text-align: center;
  margin-bottom: 6px;
}
.confirm-error button {
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  background: transparent;
  color: var(--agent-text-secondary);
  font-size: 12px;
}
.confirm-error button::after {
  border: 0;
}
.pages {
  flex: 1;
  min-height: 0;
  height: 0;
}
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.search-scroll-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.browser {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.device-scroll-shell {
  position: relative;
  z-index: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.stale-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 20px 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--agent-warning-faint);
  color: var(--agent-warning-deep);
  font-size: 12px;
  line-height: 1.5;
  flex-shrink: 0;
}
.stale-note text {
  flex: 1;
  min-width: 0;
}
.stale-revalidate {
  min-height: 32px;
  margin: 0;
  padding: 0 12px;
  border-radius: 7px;
  background: var(--agent-accent-deep);
  color: white;
  font-size: 12px;
  line-height: 30px;
  white-space: nowrap;
  flex-shrink: 0;
}
.stale-revalidate--pressed {
  transform: scale(0.97);
  opacity: 0.85;
}
.stale-revalidate[disabled] {
  opacity: 0.4;
}
.stale-revalidate::after {
  border: 0;
}
.controls {
  position: relative;
  z-index: 3;
  padding: 0 20px;
  flex-shrink: 0;
}
.chip-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 0 10px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  margin: 0;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--agent-tint);
  color: var(--agent-text-secondary);
  font-size: 12px;
  line-height: 30px;
  transition:
    transform 130ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 150ms ease;
}
.chip--pressed {
  transform: scale(0.95);
  opacity: 0.8;
}
.chip.active {
  background: var(--agent-accent-deep);
  border-color: var(--agent-accent-deep);
  color: #fff;
}
.search-toggle {
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--agent-line);
  background: var(--agent-surface-page);
  border-radius: 16px;
  flex-shrink: 0;
  transition:
    transform 120ms ease-out,
    background 160ms ease;
}
.search-toggle--pressed {
  transform: scale(0.94);
  background: var(--agent-tint);
}
.search-toggle-icon {
  display: block;
  width: 14px;
  height: 14px;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  margin: 8px 20px 10px;
  padding: 0 14px;
  border: 1px solid var(--agent-line);
  background: var(--agent-surface-page);
  border-radius: 12px;
  flex-shrink: 0;
}
.search-field-icon {
  display: block;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  height: 100%;
  font-size: 13px;
  color: var(--agent-text-primary);
}
.device-list {
  height: 100%;
  box-sizing: border-box;
  padding: 0 20px;
}
.device-list::-webkit-scrollbar {
  display: none;
}
.list-tail {
  height: 94px;
}
.group {
  margin-bottom: 20px;
}
.group-title {
  display: block;
  font-size: 12px;
  line-height: 17px;
  font-weight: 500;
  color: var(--agent-text-secondary);
  margin-bottom: 12px;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  max-width: 412px;
  margin: 0 auto;
}
.grid device-action-card {
  width: calc(50% - 6px);
}
.scroll-fade {
  position: absolute;
  z-index: 8;
  left: 0;
  right: 0;
  bottom: 0;
  height: 150px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), var(--agent-surface-page) 82%);
  transition: opacity 0.28s ease;
}
.scroll-fade.off {
  opacity: 0;
}
.cue-float {
  position: absolute;
  z-index: 15;
  left: 50%;
  bottom: 104px;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 14px;
  border: 1px solid var(--agent-line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 3px 12px rgba(var(--agent-shadow-rgb), 0.12),
    inset 0 1px 0 #fff;
  transform: translateX(-50%);
  white-space: nowrap;
  transition:
    opacity 0.22s ease,
    transform 0.22s cubic-bezier(0.23, 1, 0.32, 1);
  animation: cue-nudge 1.6s cubic-bezier(0.32, 0.72, 0, 1) 0.5s 2;
}
.cue-float.off {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
  pointer-events: none;
}
.cue-float--pressed {
  transform: translateX(-50%) scale(0.94);
}
.cue-icon {
  display: block;
  width: 11px;
  height: 11px;
}
.cue-text {
  font-size: 11px;
  line-height: 30px;
  color: var(--agent-text-secondary);
  white-space: nowrap;
}
@keyframes cue-nudge {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(4px);
  }
}
.confirm-float {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 22px 20px calc(10px + env(safe-area-inset-bottom));
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), var(--agent-surface-page) 55%);
}
.confirm-btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68%;
  min-width: 216px;
  max-width: 320px;
  height: 42px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 24px;
  border: 1px solid var(--agent-accent-deep);
  border-radius: 21px;
  background: linear-gradient(
    180deg,
    var(--agent-surface) 0%,
    var(--agent-surface-page) 64%,
    var(--agent-warning-faint) 100%
  );
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 0 rgba(var(--agent-shadow-rgb), 0.12),
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.14),
    0 7px 18px rgba(var(--agent-shadow-rgb), 0.16);
  transition:
    transform 130ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 160ms ease,
    background-color 160ms ease;
}
.confirm-btn-text {
  color: var(--agent-accent-deep);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.confirm-btn--pressed {
  transform: scale(0.975);
  background: linear-gradient(180deg, var(--agent-surface-page), var(--agent-warning-faint));
  box-shadow:
    inset 0 1px 3px rgba(var(--agent-shadow-rgb), 0.12),
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.14),
    0 5px 12px rgba(var(--agent-shadow-rgb), 0.14);
}
.confirm-btn[disabled] {
  opacity: 1;
  border-color: var(--agent-text-faint);
  background: linear-gradient(
    180deg,
    var(--agent-surface) 0%,
    var(--agent-surface-page) 62%,
    var(--agent-warning-faint) 100%
  );
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 0 rgba(var(--agent-shadow-rgb), 0.1),
    0 2px 3px rgba(var(--agent-shadow-rgb), 0.1),
    0 8px 18px rgba(var(--agent-shadow-rgb), 0.13);
}
.confirm-btn[disabled] .confirm-btn-text {
  color: var(--agent-text-muted);
}
.confirm-caption {
  color: var(--agent-text-muted);
  font-size: 10px;
  line-height: 15px;
}
.title-select-all {
  height: 32px;
  margin: 0;
  padding: 0 14px;
  border-radius: 16px;
  background: var(--agent-tint);
  color: var(--agent-text-secondary);
  font-size: 12px;
  line-height: 30px;
  white-space: nowrap;
  flex-shrink: 0;
}
.title-select-all--pressed {
  opacity: 0.7;
  transform: scale(0.96);
}
.title-select-all[disabled] {
  opacity: 0.4;
}
.back {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0 20px;
  font-size: 12px;
  line-height: 40px;
  background: transparent;
  color: var(--agent-text-muted);
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 140ms ease;
}
.back--pressed {
  transform: scale(0.97);
  opacity: 0.7;
}
.back-icon {
  display: block;
  width: 14px;
  height: 14px;
}
.note {
  display: block;
  font-size: 13px;
  color: var(--agent-text-secondary);
  margin: 12px 20px;
}
button::after {
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .search-toggle,
  .chip,
  .confirm-btn,
  .title-select-all,
  .cue-float,
  .scroll-fade {
    transition: none;
  }
  .cue-float {
    animation: none;
  }
}
/* 微信 scroll-view 需要确定的非零祖先高度；覆盖旧的 height:0 兼容写法。 */
.pages {
  height: auto;
  overflow: hidden;
}
.header-viewport {
  position: relative;
  overflow: visible;
}
.header-viewport .controls {
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 170ms ease-out;
}
.header-viewport.searching .controls {
  transform: translateX(-22px);
  opacity: 0;
  pointer-events: none;
}
.search-controls {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  box-sizing: border-box;
  opacity: 0;
  transform: translateX(22px);
  pointer-events: none;
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 170ms ease-out;
}
.header-viewport.searching .search-controls {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
.search-back {
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--agent-line);
  border-radius: 18px;
  background: var(--agent-surface-page);
  opacity: 0;
  transform: scale(0.9);
  transition:
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1) 70ms,
    opacity 150ms ease-out 70ms;
}
.header-viewport.searching .search-back {
  opacity: 1;
  transform: scale(1);
}
.search-back--pressed {
  transform: scale(0.94) !important;
}
.search-field {
  flex: 1;
  min-width: 0;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  box-sizing: border-box;
  border: 1px solid var(--agent-line);
  border-radius: 18px;
  background: var(--agent-surface-page);
  opacity: 0;
  transform: scaleX(0.16);
  transform-origin: right center;
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 120ms ease-out;
}
.header-viewport.searching .search-field {
  opacity: 1;
  transform: scaleX(1);
}
.pages {
  position: relative;
  isolation: isolate;
  flex: 1;
  min-height: 0;
  height: auto;
  overflow: hidden;
  background: var(--agent-surface-page);
}
.surface {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition:
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 160ms ease-out;
}
.devices-surface {
  z-index: 0;
  transform: translateX(0);
  opacity: 1;
  background: var(--agent-surface-page);
}
.editor-surface {
  z-index: 1;
  transform: translateX(100%);
  opacity: 1;
  overflow: hidden;
  pointer-events: none;
  background: var(--agent-surface-page);
}
.pages.editing .devices-surface {
  transform: translateX(-18%);
  opacity: 0.72;
  pointer-events: none;
}
.pages.editing .editor-surface {
  transform: translateX(0);
  pointer-events: auto;
}
.header-viewport {
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  overflow: visible;
  border-bottom: 1px solid var(--agent-line);
}
.group {
  width: 250px;
  margin-left: auto;
  margin-right: auto;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  max-width: none;
  margin: 0;
}
.grid device-action-card {
  width: 119px;
}
.editor-surface .back {
  flex-shrink: 0;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.title-state-refresh {
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  flex-shrink: 0;
}
.title-state-refresh[disabled] {
  opacity: 0.5;
}
.spinning {
  animation: state-spin 900ms linear infinite;
}
@keyframes state-spin {
  to {
    transform: rotate(360deg);
  }
}
.title-restore {
  height: 32px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid var(--agent-line);
  border-radius: 16px;
  background: transparent;
  color: var(--agent-text-secondary);
  font-size: 12px;
  line-height: 30px;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    transform 130ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 150ms ease;
}
.title-restore--pressed {
  transform: scale(0.96);
  opacity: 0.75;
}
.title-restore[disabled] {
  opacity: 0.4;
}
@media (prefers-reduced-motion: reduce) {
  .header-viewport,
  .header-viewport .controls,
  .search-controls,
  .search-back,
  .search-field,
  .surface,
  .title-restore {
    transition: none;
  }
  .pages.editing .devices-surface {
    transform: translateX(0);
    opacity: 0;
  }
  .editor-surface {
    transform: translateX(0);
    opacity: 0;
  }
  .pages.editing .editor-surface {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
/* DeviceSheet owns the safe-area inset; the action dock must not add it a second time. */
.confirm-float {
  padding: 14px 20px 10px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), var(--agent-surface-page) 42%);
}
.search-back,
.search-toggle {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  flex-shrink: 0;
}
.back {
  min-height: 44px;
}
</style>
