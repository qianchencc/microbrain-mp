<template><view class="avatar" :class="{ running }"><image :src="layers.body" class="body" /><view class="eyes-pos" :style="{ transform: `translate(${x}px,${y}px)` }"><image :src="layers.eyes" class="eyes" :class="{ blink: blinking }" /></view></view></template>
<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { avatarLayers } from '../../domains/shared/avatar.js'
const props = defineProps({running:Boolean})
const layers = computed(() => avatarLayers())
const x = ref(0), y = ref(0), blinking = ref(false)
let lookTimer, blinkTimer, blinkOff
// 眼跳：900~1800ms 随机间隔的小步幅扫视（真眼跳是快而碎的，匀速低频会显得死）
// 眨眼：3~6s 随机间隔、130ms 收放，独立于位移——单次 transition 会让眨眼拖慢
function scheduleLook() { lookTimer = setTimeout(() => { x.value = Math.random()*2.2-1.1; y.value = Math.random()*1.4-.7; scheduleLook() }, 900 + Math.random()*900) }
function scheduleBlink() { blinkTimer = setTimeout(() => { blinking.value = true; blinkOff = setTimeout(() => { blinking.value = false; scheduleBlink() }, 140) }, 2600 + Math.random()*3200) }
onMounted(() => { scheduleLook(); scheduleBlink() })
onBeforeUnmount(() => { clearTimeout(lookTimer); clearTimeout(blinkTimer); clearTimeout(blinkOff) })
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.avatar { position:relative; width:30px; height:30px; border-radius:8px; overflow:hidden; flex-shrink:0; }
.body,.eyes-pos { position:absolute; width:30px; height:30px; left:0; top:0; }
.eyes { width:30px; height:30px; }
.eyes-pos { transition:transform 340ms cubic-bezier(.23,1,.32,1); }
.eyes.blink { animation:blink 130ms ease-in-out; }
@keyframes blink { 45% { transform:scaleY(.14); } }
.body { animation:breathe 3.6s ease-in-out infinite; }
.running .body { animation-duration:1.9s; }
@keyframes breathe { 50% { transform:scale(1.03); } }
@media(prefers-reduced-motion:reduce) { .eyes-pos { transform:none!important; transition:none; }.eyes.blink { animation:none; }.body { animation:none!important; } }
</style>
