<template><view class="thinking"><view v-if="running" class="glyph"><view class="lattice"><view v-for="cell in cells" :key="cell.index" class="cell" :style="{ left: cell.x * 6 + 'px', top: cell.y * 6 + 'px', animationDelay: cell.delay + 'ms' }" /></view></view><uni-icons v-else :type="failed ? 'info' : 'checkmarkempty'" size="13" :color="failed ? 'var(--agent-warning-deep)' : 'var(--agent-success)'" /><text>{{ running ? '思考中' : failed ? '思考已中断' : seconds ? `已思考 ${seconds} 秒` : '已思考' }}</text></view></template>
<script setup>
defineProps({ running:Boolean, failed:Boolean, seconds:Number })
const cells = Array.from({length:9}, (_,index) => { const x = index % 3, y = Math.floor(index/3), distance = Math.hypot(x-1,y-1); return {index,x,y,delay:distance*700-(distance===0?180:0)} })
</script>
<style scoped lang="scss">
@import "../../styles/tokens";

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.thinking { display:flex; align-items:center; gap:6px; color:$agent-color-text-secondary; font-size:$agent-font-size-compact; min-height:24px; white-space:nowrap; }.glyph { position:relative; width:20px; height:20px; flex-shrink:0; }.lattice { position:absolute; left:0; top:0; width:28px; height:28px; transform-origin:0 0; transform:scale(.7143) translate(6.5px,6.5px); }.cell { position:absolute; width:3px; height:3px; border-radius:50%; background:currentColor; opacity:.14; animation:wave 1.7s cubic-bezier(.66,0,.34,1) infinite both; }@keyframes wave { 0%,56%,100% { opacity:.14; transform:scale(1); }28% {opacity:1;transform:scale(1.18);} }@media(prefers-reduced-motion:reduce) { .cell { animation:none; opacity:.36; } }
</style>
