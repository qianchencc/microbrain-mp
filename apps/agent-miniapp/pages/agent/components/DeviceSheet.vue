<template>
 <view v-if="mounted" class="sheet-root" :class="{ shown }">
  <view class="mask" :class="{ shown }" @tap.stop="closeFromMask" @touchend.stop="closeFromMask" @touchmove.stop.prevent />
  <!-- 架构照抄 vaul/Base UI drawer：进场动画在 wrap 上，拖拽 transform 在内层 sheet 上，
       两者永不同元素，杜绝"拖拽样式变化触发进场动画重放"。 -->
  <view class="sheet-wrap" :class="{ shown }">
   <view class="sheet" :class="{ tall }" :style="dragStyle" @tap.stop>
    <view class="handle-zone" hover-class="handle-zone--pressed" :hover-stay-time="80" @touchstart.stop="start" @touchmove.stop.prevent="move" @touchend.stop="end" @touchcancel.stop="cancelDrag"><view class="handle" /></view>
    <view class="header-top"><view class="header-copy"><view class="title-row"><text class="title">{{ title }}</text><text v-if="meta" class="meta">{{ meta }}</text></view><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view></view>
    <!-- 槽位与标题都在拖拽区之外（2026-09-17 重设计）：拖拽只认 handle-zone 全宽 44px 条带
         （vaul 44×44 命中区规格），交互控件与标题不承担拖拽（vaul handleOnly 语义）。
         注：触摸事件冒泡本就穿越组件边界（官方 tap 事件文档），分离是为了手势/点击互不吞没。 -->
    <view class="header-slot"><slot name="header" /></view>
    <view class="sheet-body"><slot /></view>
   </view>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { shouldDismissSheet } from '../sheet-drag.mjs'
const props = defineProps({ open: Boolean, title: String, subtitle: String, meta: String, tall: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const mounted = ref(false), shown = ref(false), drag = ref(0), dragging = ref(false)
let origin, lastY, lastTime, flickSpeed = 0, leaveTimer
// 关闭（遮罩点击/把手下拉）永远允许：busy 只限制编辑类操作。不设 × 按钮——
// 它位于抓取区（横杆+整个头部）右上角，会把从头部起手的拖拽截胡成点击直接关面板。
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
function closeFromMask() { if (props.open) emit('close') }
function start(event) {
 const app = typeof getApp === 'function' ? getApp() : null; if (app) (app.__dragLog ||= []).push(`start n=${event.touches.length} y=${event.touches[0]?.clientY}`)
 if (event.touches.length !== 1) { cancelDrag(); return }
 origin = event.touches[0].clientY
 lastY = origin
 lastTime = Date.now()
 flickSpeed = 0
 dragging.value = true
}
function move(event) {
 if (origin == null || event.touches.length !== 1) return
 const app = typeof getApp === 'function' ? getApp() : null; if (app) (app.__dragLog ||= []).push(`move y=${event.touches[0].clientY}`)
 const y = event.touches[0].clientY
 const now = Date.now()
 flickSpeed = (y - lastY) / Math.max(1, now - lastTime)
 lastY = y
 lastTime = now
 const delta = y - origin
 // 向下全跟随；向上只做阻尼回馈，不能通过向上拖动关闭面板
 drag.value = delta > 0 ? Math.round(delta) : Math.round(delta / 3)
}
function end() {
 dragging.value = false
 if (origin == null) return
 const dragged = drag.value
 origin = null
 // vaul CLOSE_THRESHOLD：面板可见高度的 25%（面板高≈78vh，量窗高折算），替换旧的固定 200px（小屏不适配）
 const panelHeight = Math.round((uni.getSystemInfoSync().windowHeight || 600) * 0.78)
 const app = typeof getApp === 'function' ? getApp() : null; if (app) (app.__dragLog ||= []).push(`end dragged=${dragged} flick=${flickSpeed.toFixed(2)} h=${panelHeight} dismiss=${shouldDismissSheet(dragged, flickSpeed, panelHeight)}`)
 // vaul 语义：带位移的轻扫即收（动量优先）；否则拖过面板 25% 收起；否则弹回
 if (shouldDismissSheet(dragged, flickSpeed, panelHeight)) emit('close')
 else drag.value = 0
}
function cancelDrag() { dragging.value = false; drag.value = 0; origin = null }
</script>
<style scoped>
/* 页面级底部面板：必须作为页面根节点的直接子级挂载（composer 之后），禁止放回滚动内容内部。 */
/* 只在打开和退场的 320ms 内挂载，避免依赖小程序对 fixed + pointer-events 的命中实现。 */
.sheet-root { position:fixed; left:0; right:0; top:0; bottom:0; z-index:1000; }
.mask { position:absolute; top:0; right:0; bottom:0; left:0; background:rgba(20,35,28,.32); opacity:0; transition:opacity 240ms ease; animation:mask-in 240ms ease backwards; }
.mask.shown { opacity:1; }
/* wrap：只负责进场（animation）与退场/归位（transition），拖拽期间不被内联样式触碰 */
.sheet-wrap { position:absolute; left:0; right:0; bottom:0; transform:translateY(100%); transition:transform 320ms cubic-bezier(.32,.72,0,1); animation:sheet-in 240ms cubic-bezier(.32,.72,0,1) backwards; }
.sheet-wrap.shown { transform:translateY(0); }
@keyframes sheet-in { from { transform:translateY(100%); } }
@keyframes mask-in { from { opacity:0; } }
/* sheet：只负责拖拽跟随与松手回弹，永不声明 animation */
.sheet { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); transition:transform 500ms cubic-bezier(.32,.72,0,1); box-shadow:0 -8px 32px #16372814; }
.sheet.tall { height:78vh; }
.sheet-body { display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden; }
/* 只有横杆区域可拖拽；标题、筛选和搜索控件不再被拖拽手势吞掉。 */
.handle-zone { height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 120ms ease; }
.handle-zone--pressed { background:rgba(23,107,84,.04); }
.handle { width:36px; height:4px; background:#c4cbc6; border-radius:4px; transition:width 140ms cubic-bezier(.23,1,.32,1),background 140ms ease,transform 140ms ease; }
.handle-zone--pressed .handle { width:44px; background:#9eafa5; transform:scaleY(1.15); }
.header-slot { border-bottom:1px solid #e3e8e4; }
.header-top { display:flex; align-items:center; padding:2px 20px 8px; }
.header-copy { flex:1; min-width:0; }
.title-row { display:flex; align-items:baseline; gap:8px; min-width:0; }
.title { display:block; font-size:19px; font-weight:600; color:#24382d; flex-shrink:0; }
.meta { font-size:12px; color:#78877e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
.subtitle { display:block; font-size:12px; color:#78877e; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media(prefers-reduced-motion:reduce) { .mask,.sheet-wrap,.sheet { transition:none; animation:none; } }
</style>
