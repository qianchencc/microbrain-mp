<template>
 <view class="sk" aria-hidden="true">
  <view class="sk-strip">
   <view v-for="(h, i) in BARS" :key="i" class="sk-col">
    <view class="sk-ebar"><view class="sk-bar" :class="{ alt: i % 2 }" :style="{ height: h + '%', animationDelay: (i * 80) + 'ms' }" /></view>
    <view class="sk-edlab"><view class="sk-lab" /></view>
   </view>
  </view>
  <template v-if="pies">
   <view class="sk-pies sk-slow">
    <view v-for="c in 2" :key="c" class="sk-pie">
     <view class="sk-pair"><view class="sk-ring" /><view class="sk-ring" /></view>
     <view class="sk-lines"><view class="sk-line w1" /><view class="sk-line w2" /></view>
    </view>
   </view>
   <view class="sk-legend sk-slow">
    <view v-for="(w, i) in LEGEND" :key="i" class="sk-li"><view class="sk-dot" /><view class="sk-line" :style="{ width: w + 'px' }" /></view>
   </view>
  </template>
 </view>
</template>
<script setup>
defineProps({ pies: { type: Boolean, default: true } })
const BARS = [62, 78, 55, 70, 66, 80, 58, 72, 60, 76, 64, 74, 59, 68]
const LEGEND = [30, 40, 52]
</script>
<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
.sk-strip { white-space: nowrap; overflow: hidden; margin: 10px -20px 0; padding: 2px 0 0; }
.sk-col { display: inline-flex; flex-direction: column; align-items: center; width: 21px; vertical-align: top; }
.sk-ebar { width: 100%; height: 64px; display: flex; align-items: flex-end; justify-content: center; }
.sk-bar { display: block; width: 8px; min-height: 4px; border-radius: 2.5px; background: #dce7dc; animation: sk-pulse 1.4s ease-in-out infinite; }
.sk-bar.alt { background: #e2eadf; }
.sk-edlab { position: relative; width: 100%; height: 36px; }
.sk-lab { position: absolute; left: 5px; bottom: 4px; width: 10px; height: 4px; border-radius: 2px; background: #e6ecdf; }
.sk-pies { display: flex; gap: 10px; margin-top: 16px; }
.sk-pie { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
.sk-pair { display: flex; gap: 5px; flex-shrink: 0; }
.sk-ring { width: 46px; height: 46px; box-sizing: border-box; border: 5px solid #e3eae2; border-radius: 50%; flex-shrink: 0; }
.sk-lines { flex: 1; min-width: 0; }
.sk-line { display: block; height: 6px; border-radius: 3px; background: #e6ecdf; }
.sk-line.w1 { width: 82%; }
.sk-line.w2 { width: 55%; height: 9px; border-radius: 4px; margin-top: 8px; }
.sk-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; }
.sk-li { display: flex; align-items: center; }
.sk-dot { width: 6px; height: 6px; border-radius: 2px; margin-right: 4px; background: #e3eae2; }
.sk-slow { animation: sk-pulse 2.4s ease-in-out infinite; }
@keyframes sk-pulse { 0%, 100% { opacity: .45 } 50% { opacity: .9 } }
@media(prefers-reduced-motion:reduce) { .sk-bar, .sk-slow { animation: none; opacity: .6 } }
</style>
