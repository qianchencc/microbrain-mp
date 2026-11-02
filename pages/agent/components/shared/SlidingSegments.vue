<template>
 <view class="segments" :class="{ blue: tone === 'blue', disabled }">
  <view v-if="index >= 0" class="thumb" :style="{ width: `${100/options.length}%`, transform: `translateX(${index * 100}%)` }" />
  <view v-for="option in options" :key="option.value" class="segment" :class="{ active: modelValue === option.value }" role="radio" :aria-checked="modelValue === option.value" @tap="choose(option.value)"><image v-if="option.icon" :src="'/static/' + option.icon + '.svg'" style="width:19px;height:19px" /><text>{{ option.label }}</text></view>
 </view>
</template>
<script setup>
import { computed } from 'vue'
// 点击用原生 @tap（可靠、与滚动互斥）；滑动切换只用不带 .stop 的 touchstart/touchend 位移判定，
// 不劫持触摸链（catch 会吞掉外层滚动）。滑动后短暂屏蔽 tap，防止松手位置二次触发。
const props = defineProps({ modelValue: [String, Number], options: Array, disabled: Boolean, tone: String })
const emit = defineEmits(['update:modelValue'])
const index = computed(() => props.options.findIndex(o => o.value === props.modelValue))
let origin = null, swipeUntil = 0
function choose(value) { if (Date.now() < swipeUntil) return; if (!props.disabled) emit('update:modelValue', value) }
function start(e) { origin = e.touches.length === 1 ? e.touches[0] : null }
function end(e) {
 if (!origin || props.disabled) return
 const dx = e.changedTouches[0].clientX - origin.clientX
 const dy = e.changedTouches[0].clientY - origin.clientY
 origin = null
 if (Math.abs(dx) < 20 || Math.abs(dy) > Math.abs(dx)) return
 swipeUntil = Date.now() + 350
 const next = Math.max(0, Math.min(props.options.length - 1, index.value + (dx > 0 ? 1 : -1)))
 emit('update:modelValue', props.options[next].value)
}
</script>
<style scoped lang="scss">
@import "../../styles/tokens";

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.segments { position:relative; display:flex; padding:3px; border-radius:6px; background:var(--agent-tint); min-height:36px; box-sizing:border-box; }.thumb { position:absolute; top:3px; bottom:3px; left:0; border:3px solid var(--agent-tint); border-top:0; border-bottom:0; border-radius:6px; box-sizing:border-box; background:$agent-color-accent; box-shadow:0 1px 4px rgba(var(--agent-shadow-rgb),.08); transition:transform 220ms cubic-bezier(.23,1,.32,1); }.segment { position:relative; z-index:1; flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:6px 0; font-size:11px; color:var(--agent-text-muted); }.active { color:white; }.blue { background:transparent; }.blue .thumb { background:var(--agent-accent-faint); border-color:var(--agent-surface); box-shadow:inset 0 0 0 1px var(--agent-chart); }.blue .active { color:var(--agent-accent); }.disabled { opacity:.45; }@media(prefers-reduced-motion:reduce) { .thumb { transition:none; } }
</style>
