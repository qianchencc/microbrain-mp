<template>
 <view v-if="hasRoster" class="panel">
  <view class="panel-head">
   <text class="panel-meta">{{ meta }}</text>
   <view class="seg">
    <text class="seg__item" :class="{ 'seg__item--on': tab === 'overview' }" hover-class="seg__item--tap" @tap="tab = 'overview'">概览</text>
    <text class="seg__item" :class="{ 'seg__item--on': tab === 'draft' }" hover-class="seg__item--tap" @tap="tab = 'draft'">草案</text>
   </view>
  </view>
  <view v-if="stats" class="panel-stats">
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.total }}</text><text class="panel-stat__label">共找到</text></view>
   <view class="panel-stat panel-stat--act"><text class="panel-stat__num">{{ stats.operate }}</text><text class="panel-stat__label">拟执行</text></view>
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.excluded }}</text><text class="panel-stat__label">已排除</text></view>
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.satisfied }}</text><text class="panel-stat__label">无需操作</text></view>
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.standby + stats.untouched }}</text><text class="panel-stat__label">其他未选</text></view>
  </view>
  <view class="panel-body" :class="{ 'panel-body--overview': tab === 'overview' }">
   <DeviceRoster v-show="tab === 'overview'" class="panel-pane" :entries="roster" :draft="draft" :observed="result?.observedStates" :active="tab === 'overview'" />
   <view v-show="tab === 'draft'" class="panel-pane--draft">
    <ActionDraftCard :source="source" embedded :draft="draft" :result="result" :busy="busy"
     @select="emit('select', $event)" @configure="emit('configure', $event)" @browse="emit('browse')"
     @updated="emit('updated', $event)" @editing="emit('editing', $event)" />
   </view>
  </view>
  <view v-if="pending" class="panel-foot">
   <text class="panel-foot__count">已选 {{ selectedCount }} 项</text>
   <button class="foot-quiet" :disabled="busy" hover-class="foot-quiet--pressed" @tap="emit('cancel')">取消</button>
   <button class="foot-primary" :disabled="busy || !selectedCount" :loading="busy" hover-class="foot-primary--pressed" @tap="emit('confirm')">执行操作</button>
  </view>
  <view v-else-if="draft.status === 'EXPIRED'" class="panel-foot">
   <text class="panel-foot__hint">核验已过期，未执行</text>
   <button class="foot-primary" :disabled="busy" hover-class="foot-primary--pressed" @tap="emit('revalidate')">重新核验</button>
  </view>
  <view v-else-if="(result || draft.status === 'EXECUTING') && notice" class="panel-foot panel-foot--receipt">
   <uni-icons :class="{ spinning: notice.kind === 'executing' }" :type="notice.kind === 'executing' ? 'loop' : notice.kind === 'attention' ? 'info' : 'checkmarkempty'" size="16" :color="notice.kind === 'attention' ? 'var(--agent-warning-deep)' : 'var(--agent-text-secondary)'" />
   <text class="panel-foot__receipt">{{ notice.text }}</text>
  </view>
 </view>
 <ActionDraftCard :source="source" v-else :draft="draft" :result="result" :busy="busy"
  @select="emit('select', $event)" @confirm="emit('confirm')" @cancel="emit('cancel')"
  @revalidate="emit('revalidate')" @updated="emit('updated', $event)" @editing="emit('editing', $event)"
  @configure="emit('configure', $event)" @browse="emit('browse')" />
</template>

<script setup>
import { computed, ref } from 'vue'
import ActionDraftCard from './ActionDraftCard.vue'
import DeviceRoster from './DeviceRoster.vue'
import { executionNotice } from '../../lib/actions.mjs'

const props = defineProps({
	draft: { type: Object, required: true },
	roster: Array,
	result: Object,
	busy: Boolean,
	source: { type: String, default: 'office' },
})
const emit = defineEmits(['confirm', 'cancel', 'select', 'revalidate', 'updated', 'editing', 'configure', 'browse'])

// 提案到达即落草案页；无 roster 的旧持久化轮次整体降级为原独立草案卡。
const tab = ref('draft')
const hasRoster = computed(() => Boolean(props.roster?.length))
// 执行中只认草案权威状态；终态文案以规范化 result.message 为准，旧记录按状态真实兜底。
const notice = computed(() => executionNotice(props.draft, props.result))
const headingText = computed(() => ({ PENDING_CONFIRMATION: '待确认操作', EXECUTING: '正在执行', CANCELLED: '草案已取消', EXPIRED: '草案已过期', NO_CHANGE: '无需操作', INTERRUPTED: '执行中断' }[props.draft.status] || '操作结果'))
const meta = computed(() => (tab.value === 'overview' ? '概览 · 按位置分组' : headingText.value))
const stats = computed(() => props.draft.counts)
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const selectedCount = computed(() => props.draft.selectedActionIds?.length ?? 0)
</script>

<style scoped lang="scss">
@import "../../styles/tokens";

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
/* 草案随对话自然展开；只有长概览列表保留有界浏览区，避免两层纵向滚动争抢。切换仍用 v-show 保留选择。 */
.panel { margin-top:12px; padding:12px; border-radius:16px; background:linear-gradient(var(--agent-surface),var(--agent-surface-page)); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.10),0 1px 2px rgba(var(--agent-shadow-rgb),.07),0 10px 24px rgba(var(--agent-shadow-rgb),.07); }
.panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.panel-meta { flex:1; min-width:0; color:$agent-color-text-secondary; font-size:$agent-font-size-compact; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.seg { flex-shrink:0; display:flex; gap:2px; padding:2px; border-radius:13px; background:$agent-color-tint; box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.08); }
.seg__item { padding:0 12px; border-radius:11px; color:$agent-color-text-secondary; font-size:11.5px; line-height:22px; transition:background-color 140ms ease,color 140ms ease; }
.seg__item--on { background:$agent-color-surface; color:$agent-color-text-primary; font-weight:600; box-shadow:0 1px 2px rgba(var(--agent-shadow-rgb),.10),inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.06); }
.seg__item--tap { opacity:.7; }
.panel-stats { display:flex; margin-top:10px; border-radius:$agent-radius-medium; background:linear-gradient(var(--agent-surface),var(--agent-surface-page)); box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.08),inset 0 1px 0 rgba(255,255,255,.8); }
.panel-stat { flex:1; min-width:0; position:relative; padding:8px 4px 7px; text-align:center; }
.panel-stat + .panel-stat::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:.5px; background:$agent-color-line; }
.panel-stat__num { display:block; color:$agent-color-text-primary; font-size:18px; font-weight:650; line-height:1.15; letter-spacing:-.3px; font-variant-numeric:tabular-nums; }
.panel-stat--act .panel-stat__num { color:$agent-color-accent; }
.panel-stat__label { display:block; margin-top:1px; color:$agent-color-text-muted; font-size:10px; }
.panel-body { position:relative; margin-top:10px; overflow:hidden; }
.panel-body--overview { height:300px; }
.panel-pane { position:absolute; inset:0; }
.panel-pane--draft::-webkit-scrollbar { display:none; }
.panel-foot { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:8px; padding-top:8px; border-top:.5px solid $agent-color-line; }
.panel-foot__count { margin-right:auto; color:$agent-color-text-muted; font-size:11px; white-space:nowrap; }
.panel-foot__hint { margin-right:auto; color:$agent-color-text-muted; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.panel-foot--receipt { justify-content:flex-start; gap:$agent-space-small; }
.panel-foot__receipt { flex:1; min-width:0; color:$agent-color-text-secondary; font-size:$agent-font-size-compact; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.foot-quiet,.foot-primary { display:flex; align-items:center; justify-content:center; min-width:0; min-height:36px; margin:0; padding:0 12px; border-radius:10px; font-size:$agent-font-size-compact; line-height:36px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 160ms ease,box-shadow 160ms ease,opacity 160ms ease; }
.foot-quiet { min-width:48px; border:0; background:transparent; color:$agent-color-text-muted; }
.foot-primary { min-width:112px; border:1px solid $agent-color-accent-deep; background:$agent-color-accent-deep; color:#fff; box-shadow:0 4px 10px rgba(var(--agent-shadow-rgb),.13); }
.foot-primary[disabled] { opacity:.52; box-shadow:none; }
.foot-quiet[disabled] { opacity:.45; }
.foot-quiet--pressed,.foot-primary--pressed { transform:scale(.975); }
.foot-quiet--pressed { background:$agent-color-tint; }
.foot-primary--pressed { background:$agent-color-accent-deep; box-shadow:0 2px 6px rgba(var(--agent-shadow-rgb),.11); }
.spinning { animation:panel-spin 900ms linear infinite; }
@keyframes panel-spin { to { transform:rotate(360deg); } }
button::after { border:0; }
@media(prefers-reduced-motion:reduce){ .seg__item,.foot-quiet,.foot-primary { transition:none; }.spinning { animation:none; } }
</style>
