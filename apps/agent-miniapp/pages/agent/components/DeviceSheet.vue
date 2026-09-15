<template>
 <view v-if="mounted" class="sheet-root" :class="{ shown }">
  <view class="mask" :class="{ shown }" @tap="emit('close')" @touchmove.stop.prevent />
  <!-- 架构照抄 vaul/Base UI drawer：进场动画在 wrap 上，拖拽 transform 在内层 sheet 上，
       两者永不同元素，杜绝"拖拽样式变化触发进场动画重放"。 -->
  <view class="sheet-wrap" :class="{ shown }">
   <view class="sheet" :style="dragStyle">
    <view class="grab" @touchstart="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="cancelDrag">
     <view class="handle-zone"><view class="handle" /></view>
     <view class="header"><view><text class="title">{{ title }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><button class="close" aria-label="关闭" @tap="emit('close')"><uni-icons type="closeempty" size="22" color="#728178" /></button></view>
    </view>
    <view class="sheet-body"><slot /></view>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String, busy: Boolean })
const emit = defineEmits(['close'])
const mounted = ref(false), shown = ref(false), drag = ref(0), dragging = ref(false)
let origin, lastY, lastTime, flickSpeed = 0, leaveTimer
// 关闭（遮罩/把手/×）永远允许：busy 只限制编辑类操作。
watch(() => props.open, value => {
 clearTimeout(leaveTimer)
 if (value) {
  mounted.value = true
  shown.value = true
 } else {
  shown.value = false
  cancelDrag()
  leaveTimer = setTimeout(() => { mounted.value = false }, 320)
 }
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(leaveTimer))
const dragStyle = computed(() => dragging.value
 ? { transform: `translateY(${drag.value}px)`, transition: 'none' }
 : {})
function start(event) {
 if (event.touches.length !== 1) { cancelDrag(); return }
 origin = event.touches[0].clientY
 lastY = origin
 lastTime = Date.now()
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
 // 向下全跟随；向上阻尼（vaul：越拖越少动），不做硬 clamp
 drag.value = delta > 0 ? Math.round(delta) : Math.round(delta / 3)
}
function end() {
 dragging.value = false
 if (origin == null) return
 const dragged = drag.value
 origin = null
 // vaul 语义：轻扫即收（动量优先）；否则拖过约 1/3 高度收起；否则弹回
 if (flickSpeed > .5 || dragged > 200) emit('close')
 else drag.value = 0
}
function cancelDrag() { dragging.value = false; drag.value = 0; origin = null }
</script>
<style scoped>
/* 页面级底部面板：必须作为页面根节点的直接子级挂载（composer 之后），禁止放回滚动内容内部。 */
/* 非显示态整体放行点击：即使 mounted 意外卡住，也不允许隐形遮罩拦死页面 */
.sheet-root { position:fixed; left:0; right:0; top:0; bottom:0; z-index:1000; pointer-events:none; }
.sheet-root.shown { pointer-events:auto; }
.mask { position:absolute; top:0; right:0; bottom:0; left:0; background:rgba(20,35,28,.32); opacity:0; transition:opacity 240ms ease; animation:mask-in 240ms ease backwards; }
.mask.shown { opacity:1; }
/* wrap：只负责进场（animation）与退场/归位（transition），拖拽期间不被内联样式触碰 */
.sheet-wrap { position:absolute; left:0; right:0; bottom:0; transform:translateY(100%); transition:transform 320ms cubic-bezier(.32,.72,0,1); animation:sheet-in 240ms cubic-bezier(.32,.72,0,1) backwards; }
.sheet-wrap.shown { transform:translateY(0); }
@keyframes sheet-in { from { transform:translateY(100%); } }
@keyframes mask-in { from { opacity:0; } }
/* sheet：只负责拖拽跟随与松手回弹，永不声明 animation */
.sheet { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); transition:transform 320ms cubic-bezier(.32,.72,0,1); box-shadow:0 -8px 32px #16372814; }
.sheet-body { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
/* 抓取区 = 横杠 + 整个头部 */
.grab { flex-shrink:0; }
.handle-zone { height:24px; display:flex; align-items:center; justify-content:center; }
.handle { width:42px; height:5px; background:#c4cbc6; border-radius:5px; }
.header { display:flex; align-items:center; justify-content:space-between; padding:4px 20px 16px; border-bottom:1px solid #e3e8e4; }
.header>view { min-width:0; }
.title { display:block; font-size:19px; font-weight:600; color:#24382d; }
.subtitle { display:block; font-size:12px; color:#78877e; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.close { margin:0; padding:0; width:44px; height:44px; line-height:44px; background:transparent; flex-shrink:0; }
.close::after { border:0; }
@media(prefers-reduced-motion:reduce) { .mask,.sheet-wrap,.sheet { transition:none; animation:none; } }
</style>
