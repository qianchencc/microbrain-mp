<template><view class="thinking"><view v-if="running" class="glyph"><view v-for="cell in cells" :key="cell.index" class="cell" :style="{ left: cell.x * 6 + 'px', top: cell.y * 6 + 'px', animationDelay: cell.delay + 'ms' }" /></view><uni-icons v-else :type="failed ? 'info' : 'checkmarkempty'" size="14" :color="failed ? '#925b0a' : '#176b54'" /><text>{{ running ? '思考中' : failed ? '思考已中断' : seconds ? `已思考 ${seconds} 秒` : '已思考' }}</text></view></template>
<script setup>
defineProps({ running:Boolean, failed:Boolean, seconds:Number })
const cells = Array.from({length:9}, (_,index) => { const x = index % 3, y = Math.floor(index/3), distance = Math.hypot(x-1,y-1); return {index,x,y,delay:distance*700-(distance===0?180:0)} })
</script>
<style scoped>
.thinking { display:flex; align-items:center; gap:7px; color:#647169; font-size:12px; min-height:30px; white-space:nowrap; }.glyph { position:relative; width:17px; height:17px; }.cell { position:absolute; width:3px; height:3px; border-radius:50%; background:#176b54; animation:wave 1.7s cubic-bezier(.66,0,.34,1) infinite both; }@keyframes wave { 0%,56%,100% { opacity:.14; transform:scale(1); }28% {opacity:1;transform:scale(1.18);} }@media(prefers-reduced-motion:reduce) { .cell { animation:none; opacity:.36; } }
</style>
