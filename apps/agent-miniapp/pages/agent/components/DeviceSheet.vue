<template>
 <view v-if="mounted" class="sheet-root">
  <view class="mask" :class="{ shown }" @tap="emit('close')" @touchmove.stop.prevent />
  <view class="sheet" :class="{ shown }" :style="dragStyle">
   <view class="grab" @touchstart="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="cancelDrag">
    <view class="handle-zone"><view class="handle" /></view>
    <view class="header"><view><text class="title">{{ title }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><button class="close" aria-label="关闭" @tap="emit('close')"><uni-icons type="closeempty" size="22" color="#728178" /></button></view>
   </view>
   <view class="sheet-body"><slot /></view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String, busy: Boolean })
const emit = defineEmits(['close'])
const mounted = ref(false), shown = ref(false), drag = ref(0), dragging = ref(false)
let origin, startTime, lastY, lastTime, flickSpeed = 0, leaveTimer
// 入场用 CSS animation（插入即播放）；离场在已渲染节点上做 class 过渡，240ms 后卸载。
// 关闭（遮罩/把手/×）永远允许：busy 只限制编辑类操作。
watch(() => props.open, value => {
 clearTimeout(leaveTimer)
 if (value) {
  mounted.value = true
  shown.value = true
 } else {
  shown.value = false
  cancelDrag()
  leaveTimer = setTimeout(() => { mounted.value = false }, 240)
 }
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(leaveTimer))
// 拖拽期间内联覆盖 transform/transition/animation：进场 animation 无论处于何种状态都无法与手指位移竞争
const dragStyle = computed(() => dragging.value
 ? { transform: `translateY(${drag.value}px)`, transition: 'none', animation: 'none' }
 : {})
function start(event) {
 if (event.touches.length !== 1) { cancelDrag(); return }
 origin = event.touches[0].clientY
 lastY = origin
 startTime = lastTime = Date.now()
 flickSpeed = 0
 dragging.value = true
}
function move(event) {
 if (origin == null || event.touches.length !== 1) return
 const y = event.touches[0].clientY
 const now = Date.now()
 flickSpeed = (y - lastY) / Math.max(1, now - lastTime)
 lastY = y
 lastTime = now
 const delta = y - origin
 // 向下全跟随；向上阻尼（1/3 摩擦），不做硬 clamp
 drag.value = delta > 0 ? Math.round(delta) : Math.round(delta / 3)
}
function end() {
 dragging.value = false
 if (origin == null) return
 const dragged = drag.value
 origin = null
 // 动量优先：轻扫即收；否则距离超过 64px 收起，否则弹回
 if (flickSpeed > .5 || dragged > 64) emit('close')
 else drag.value = 0
}
function cancelDrag() { dragging.value = false; drag.value = 0; origin = null }
</script>
<style scoped>
/* 页面级底部面板：必须作为页面根节点的直接子级挂载（composer 之后），禁止放回滚动内容内部。 */
.sheet-root { position:fixed; left:0; right:0; top:0; bottom:0; z-index:1000; }
.mask { position:absolute; top:0; right:0; bottom:0; left:0; background:rgba(20,35,28,.32); opacity:0; transition:opacity 240ms ease; animation:mask-in 240ms ease backwards; }
.mask.shown { opacity:1; }
.sheet { position:absolute; left:0; right:0; bottom:0; width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); transform:translateY(100%); transition:transform 240ms cubic-bezier(.32,.72,0,1); animation:sheet-in 240ms cubic-bezier(.32,.72,0,1) backwards; box-shadow:0 -8px 32px #16372814; }
.sheet.shown { transform:translateY(0); }
@keyframes sheet-in { from { transform:translateY(100%); } }
@keyframes mask-in { from { opacity:0; } }
.sheet-body { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
/* 抓取区 = 横杠 + 整个头部：足够大的拖拽目标，轻扫（>0.5px/ms）或拖过 64px 收起 */
.grab { flex-shrink:0; }
.handle-zone { height:24px; display:flex; align-items:center; justify-content:center; }
.handle { width:42px; height:5px; background:#c4cbc6; border-radius:5px; }
.header { display:flex; align-items:center; justify-content:space-between; padding:4px 20px 16px; border-bottom:1px solid #e3e8e4; }
.header>view { min-width:0; }
.title { display:block; font-size:19px; font-weight:600; color:#24382d; }
.subtitle { display:block; font-size:12px; color:#78877e; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.close { margin:0; padding:0; width:44px; height:44px; line-height:44px; background:transparent; flex-shrink:0; }
.close::after { border:0; }
@media(prefers-reduced-motion:reduce) { .mask,.sheet { transition:none; animation:none; } }
</style>
