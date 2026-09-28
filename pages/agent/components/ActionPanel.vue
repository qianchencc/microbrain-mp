<template>
 <view v-if="hasRoster" class="panel">
  <view class="panel-head">
   <text class="panel-meta">{{ meta }}</text>
   <view class="seg">
    <text class="seg__item" :class="{ 'seg__item--on': tab === 'overview' }" hover-class="seg__item--tap" @tap="tab = 'overview'">概览</text>
    <text class="seg__item" :class="{ 'seg__item--on': tab === 'draft' }" hover-class="seg__item--tap" @tap="tab = 'draft'">草案</text>
   </view>
  </view>
  <view class="panel-stats">
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.total }}</text><text class="panel-stat__label">共找到</text></view>
   <view class="panel-stat panel-stat--act"><text class="panel-stat__num">{{ stats.operate }}</text><text class="panel-stat__label">拟执行</text></view>
   <view class="panel-stat"><text class="panel-stat__num">{{ stats.idle }}</text><text class="panel-stat__label">不动</text></view>
  </view>
  <view class="panel-body">
   <DeviceRoster v-show="tab === 'overview'" class="panel-pane" :entries="roster" :draft="draft" :observed="result?.observedStates" :active="tab === 'overview'" />
   <scroll-view v-show="tab === 'draft'" scroll-y enhanced :show-scrollbar="false" class="panel-pane panel-pane--draft">
    <ActionDraftCard embedded :draft="draft" :result="result" :busy="busy"
     @select="emit('select', $event)" @configure="emit('configure', $event)" @browse="emit('browse')"
     @updated="emit('updated', $event)" @editing="emit('editing', $event)" />
   </scroll-view>
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
  <view v-else-if="result || draft.status === 'EXECUTING'" class="panel-foot panel-foot--receipt">
   <uni-icons :class="{ spinning: draft.status === 'EXECUTING' }" :type="draft.status === 'EXECUTING' ? 'loop' : result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? 'info' : 'checkmarkempty'" size="16" :color="result && !['ACCEPTED','NO_CHANGE'].includes(result.status) ? '#ad711b' : '#526d5e'" />
   <text class="panel-foot__receipt">{{ result?.message || '正在执行，请稍候' }}</text>
  </view>
 </view>
 <ActionDraftCard v-else :draft="draft" :result="result" :busy="busy"
  @select="emit('select', $event)" @confirm="emit('confirm')" @cancel="emit('cancel')"
  @revalidate="emit('revalidate')" @updated="emit('updated', $event)" @editing="emit('editing', $event)"
  @configure="emit('configure', $event)" @browse="emit('browse')" />
</template>

<script setup>
import { computed, ref } from 'vue'
import { rosterLiveStats } from '../device-roster.js'
import ActionDraftCard from './ActionDraftCard.vue'
import DeviceRoster from './DeviceRoster.vue'

const props = defineProps({
	draft: { type: Object, required: true },
	roster: Array,
	result: Object,
	busy: Boolean,
})
const emit = defineEmits(['confirm', 'cancel', 'select', 'revalidate', 'updated', 'editing', 'configure', 'browse'])

// 提案到达即落草案页；无 roster 的旧持久化轮次整体降级为原独立草案卡。
const tab = ref('draft')
const hasRoster = computed(() => Boolean(props.roster?.length))

const headingText = computed(() => ({ PENDING_CONFIRMATION: '待确认操作', EXECUTING: '正在执行', CANCELLED: '草案已取消', EXPIRED: '草案已过期', NO_CHANGE: '无需操作', INTERRUPTED: '执行中断' }[props.draft.status] || '操作结果'))
const meta = computed(() => (tab.value === 'overview' ? '概览 · 按位置分组' : headingText.value))
const stats = computed(() => rosterLiveStats(props.roster || [], props.draft))
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const selectedCount = computed(() => props.draft.selectedActionIds?.length ?? 0)
</script>

<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
/* 操作面板 = 概览+草案一体卡：外卡 chrome + 固定体高 + 常驻底栏。
   铁律：切页签只 v-show 不 v-if（保住草案卡 states 缓存与滚动位）；
   body 固定 300px，两页各自内部滚动，外卡高度不随页签/内容变化。 */
.panel { margin-top:12px; padding:12px; border-radius:16px; background:linear-gradient(#fdfefd,#f6f8f5); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 .5px rgba(26,55,43,.10),0 1px 2px rgba(28,57,42,.07),0 10px 24px rgba(28,57,42,.07); }
.panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.panel-meta { flex:1; min-width:0; color:#63756b; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.seg { flex-shrink:0; display:flex; gap:2px; padding:2px; border-radius:13px; background:#e9ede9; box-shadow:inset 0 0 0 .5px rgba(26,55,43,.08); }
.seg__item { padding:0 12px; border-radius:11px; color:#67736b; font-size:11.5px; line-height:22px; transition:background-color 140ms ease,color 140ms ease; }
.seg__item--on { background:#fdfefd; color:#21382c; font-weight:600; box-shadow:0 1px 2px rgba(28,57,42,.10),inset 0 0 0 .5px rgba(26,55,43,.06); }
.seg__item--tap { opacity:.7; }
.panel-stats { display:flex; margin-top:10px; border-radius:12px; background:linear-gradient(#fafbfa,#f1f4f0); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.08),inset 0 1px 0 rgba(255,255,255,.8); }
.panel-stat { flex:1; min-width:0; position:relative; padding:8px 4px 7px; text-align:center; }
.panel-stat + .panel-stat::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:.5px; background:#dbe2dc; }
.panel-stat__num { display:block; color:#17251f; font-size:18px; font-weight:650; line-height:1.15; letter-spacing:-.3px; font-variant-numeric:tabular-nums; }
.panel-stat--act .panel-stat__num { color:#176b54; }
.panel-stat__label { display:block; margin-top:1px; color:#8b9991; font-size:10px; }
.panel-body { position:relative; height:300px; margin-top:10px; overflow:hidden; }
.panel-pane { position:absolute; inset:0; }
.panel-pane--draft::-webkit-scrollbar { display:none; }
.panel-foot { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:8px; padding-top:8px; border-top:.5px solid #dbe3dd; }
.panel-foot__count { margin-right:auto; color:#7a8880; font-size:11px; white-space:nowrap; }
.panel-foot__hint { margin-right:auto; color:#8b9991; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.panel-foot--receipt { justify-content:flex-start; gap:8px; }
.panel-foot__receipt { flex:1; min-width:0; color:#526d5e; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.foot-quiet,.foot-primary { display:flex; align-items:center; justify-content:center; min-width:0; min-height:36px; margin:0; padding:0 12px; border-radius:10px; font-size:12px; line-height:36px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 160ms ease,box-shadow 160ms ease,opacity 160ms ease; }
.foot-quiet { min-width:48px; border:0; background:transparent; color:#718078; }
.foot-primary { min-width:112px; border:1px solid #176b54; background:#176b54; color:#fff; box-shadow:0 4px 10px #176b5422; }
.foot-primary[disabled] { opacity:.52; box-shadow:none; }
.foot-quiet[disabled] { opacity:.45; }
.foot-quiet--pressed,.foot-primary--pressed { transform:scale(.975); }
.foot-quiet--pressed { background:#eef3ef; }
.foot-primary--pressed { background:#126149; box-shadow:0 2px 6px #176b541c; }
.spinning { animation:panel-spin 900ms linear infinite; }
@keyframes panel-spin { to { transform:rotate(360deg); } }
button::after { border:0; }
@media(prefers-reduced-motion:reduce){ .seg__item,.foot-quiet,.foot-primary { transition:none; }.spinning { animation:none; } }
</style>
