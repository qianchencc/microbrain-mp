<template>
 <view class="roster-shell">
  <scroll-view scroll-y enhanced :show-scrollbar="false" class="roster" :class="{ 'roster--mask-top': !atTop, 'roster--mask-bottom': hasMore }" :scroll-top="scrollCtrl" scroll-with-animation @scroll="onScroll">
   <view class="roster-inner">
    <view v-for="group in groups" :key="group.location" class="roster-group">
     <view class="roster-group__head"><text class="roster-group__name">{{ group.location }}</text><text v-if="group.operateCount" class="roster-group__meta">{{ group.operateCount }} 项拟执行</text></view>
     <view v-for="item in group.items" :key="item.key" class="roster-row" :class="{ 'roster-row--quiet': item.quiet }">
      <image v-if="item.marker.src" class="roster-thumb" :src="item.marker.src" mode="heightFix" />
      <text v-else class="roster-kind" :class="`roster-kind--${kindTone(item.marker.code)}`">{{ item.marker.code }}</text>
      <text class="roster-name">{{ item.name }}</text>
      <view class="roster-state"><text v-if="item.state.dot" class="roster-dot" :class="`roster-dot--${item.state.dot}`" /><text class="roster-state__text">{{ item.state.text }}</text></view>
      <text class="roster-act" :class="{ 'roster-act--quiet': item.action.quiet }">{{ item.action.text }}</text>
     </view>
    </view>
    <view class="roster-tail" />
   </view>
  </scroll-view>
  <view class="roster-cue" :class="{ off: !hasMore }" hover-class="roster-cue--pressed" @tap="scrollNext"><image class="roster-cue__icon" src="/static/chevron-down.svg" /></view>
 </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { rosterGroups, rosterLiveView } from '../../lib/actions.mjs'

const props = defineProps({
	entries: { type: Array, required: true },
	draft: Object,
	observed: Object,
	active: Boolean,
})

const groups = computed(() => rosterGroups(props.entries, props.draft).map(group => ({
	...group,
	items: group.items.map(entry => rosterLiveView(entry, props.draft, props.observed)),
})))

const kindTone = code => ({ LGT: 'lgt', AC: 'ac', DOOR: 'door' }[code] || 'dev')

const instance = getCurrentInstance()
const scrollY = ref(0), scrollCtrl = ref(0), viewportH = ref(0), contentH = ref(0)
const atTop = computed(() => scrollY.value <= 4)
// 游标/渐隐只判「是否到底」一个布尔，不做剩余台数计算。
const hasMore = computed(() => contentH.value > 0 && scrollY.value + viewportH.value < contentH.value - 4)

function onScroll(event) { scrollY.value = event?.detail?.scrollTop ?? scrollY.value }

function scrollNext() { scrollCtrl.value = scrollY.value + Math.max(120, viewportH.value - 48) }

function measure() {
	uni.createSelectorQuery().in(instance.proxy)
		.select('.roster').boundingClientRect()
		.select('.roster-inner').boundingClientRect()
		.exec(rects => {
			viewportH.value = rects?.[0]?.height ?? 0
			contentH.value = rects?.[1]?.height ?? 0
		})
}

onMounted(() => nextTick(measure))
// 面板隐藏页 display:none 时测量为 0；重新可见与清单变化后都需重测。
watch(() => props.active, value => { if (value) nextTick(measure) })
watch(() => props.entries, () => nextTick(measure))
</script>

<style scoped lang="scss">
@import "../../styles/tokens";

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
/* 面板内嵌概览页：高度完全由 ActionPanel 固定体高供给，本组件不自带外边距。
   边缘渐隐用 scroll-view 自身 mask（禁色带覆盖层，同 .rail 铁律）；
   v 游标视觉沿用 DraftSheetLayer cue-float 的浮动胶囊语言，图标化、只判到底。 */
.roster-shell { position:relative; height:100%; overflow:hidden; }
.roster { height:100%; box-sizing:border-box; }
.roster::-webkit-scrollbar { display:none; }
.roster--mask-top { -webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,0) 0,#000 16px,#000 100%); mask-image:linear-gradient(to bottom,rgba(0,0,0,0) 0,#000 16px,#000 100%); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
.roster--mask-bottom { -webkit-mask-image:linear-gradient(to bottom,#000 0,#000 calc(100% - 16px),rgba(0,0,0,0) 100%); mask-image:linear-gradient(to bottom,#000 0,#000 calc(100% - 16px),rgba(0,0,0,0) 100%); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
.roster--mask-top.roster--mask-bottom { -webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,0) 0,#000 16px,#000 calc(100% - 16px),rgba(0,0,0,0) 100%); mask-image:linear-gradient(to bottom,rgba(0,0,0,0) 0,#000 16px,#000 calc(100% - 16px),rgba(0,0,0,0) 100%); }
.roster-tail { height:6px; }
.roster-group { overflow:hidden; border-radius:14px; background:linear-gradient(#fff,var(--agent-surface-page)); box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.10),inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(var(--agent-shadow-rgb),.06),0 8px 20px rgba(var(--agent-shadow-rgb),.05); }
.roster-group + .roster-group { margin-top:10px; }
.roster-group__head { display:flex; align-items:baseline; justify-content:space-between; gap:$agent-space-small; padding:8px 14px 6px; }
.roster-group__name { color:$agent-color-text-secondary; font-size:11px; font-weight:600; letter-spacing:.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.roster-group__meta { flex-shrink:0; color:$agent-color-text-muted; font-size:11px; }
.roster-row { position:relative; display:flex; align-items:center; gap:$agent-space-small; min-height:38px; padding:9px 14px; }
.roster-row + .roster-row::before { content:''; position:absolute; left:14px; right:0; top:0; height:.5px; background:$agent-color-line; }
/* 行首标记：真实插画裸放（24px 高、宽自适应、无框无底色），无图时退回 code 徽章。 */
.roster-thumb { flex-shrink:0; width:auto; max-width:38px; height:24px; filter:drop-shadow(0 1px 1px rgba(var(--agent-shadow-rgb),.18)); }
.roster-kind { flex-shrink:0; width:20px; height:20px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:7px; font-weight:700; letter-spacing:.2px; }
.roster-kind--lgt { background:$agent-color-warning-faint; color:$agent-color-warning-deep; box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.18); }
.roster-kind--ac { background:$agent-color-tint; color:$agent-color-text-secondary; box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.16); }
.roster-kind--door { background:$agent-color-tint; color:$agent-color-text-secondary; box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.16); }
.roster-kind--dev { background:$agent-color-tint; color:$agent-color-text-muted; box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.16); }
/* 迁移链行语法：[标记] 短名 …… ●现状 → 意图。三槽铁律不变：
   名槽 flex:1+min-width:0+ellipsis，状态/处置槽 flex-shrink:0+max-width+ellipsis，行禁 flex-wrap。 */
.roster-name { flex:1; min-width:0; color:$agent-color-text-primary; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.roster-state { flex-shrink:0; display:flex; align-items:center; gap:4px; max-width:32%; }
.roster-dot { flex-shrink:0; width:5px; height:5px; border-radius:50%; }
.roster-dot--on { background:$agent-color-warning-deep; }
.roster-dot--off { background:$agent-color-text-faint; }
.roster-state__text { color:$agent-color-text-secondary; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.roster-act { flex-shrink:0; max-width:38%; color:$agent-color-accent; font-size:11.5px; font-weight:650; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.roster-act--quiet { color:$agent-color-text-faint; font-weight:400; }
.roster-row--quiet .roster-name { color:$agent-color-text-muted; }
.roster-row--quiet .roster-state__text { color:$agent-color-text-faint; }
.roster-row--quiet .roster-thumb { opacity:.55; }
.roster-cue { position:absolute; z-index:15; left:50%; bottom:8px; width:30px; height:22px; display:flex; align-items:center; justify-content:center; border:1px solid $agent-color-line; border-radius:$agent-radius-medium; background:rgba(255,255,255,.95); box-shadow:0 3px 12px rgba(var(--agent-shadow-rgb),.12),inset 0 1px 0 #fff; transform:translateX(-50%); transition:opacity .22s ease,transform .22s cubic-bezier(.23,1,.32,1); }
.roster-cue.off { opacity:0; transform:translateX(-50%) translateY(6px); pointer-events:none; }
.roster-cue--pressed { transform:translateX(-50%) scale(.94); }
.roster-cue__icon { display:block; width:11px; height:11px; }
@media(prefers-reduced-motion:reduce){ .roster-cue { transition:none; } }
</style>
