<template>
 <uni-popup ref="popup" type="bottom" :safe-area="false" :is-mask-click="!busy" mask-background-color="rgba(20,35,28,.32)" @change="changed">
  <view class="sheet" :style="{ transform: `translateY(${drag}px)`, transition: dragging ? 'none' : undefined }">
   <view class="handle-zone" @touchstart="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="cancelDrag"><view class="handle" /></view>
   <view class="header"><view><text class="title">{{ title }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view><button class="close" :disabled="busy" aria-label="关闭" @tap="emit('close')"><uni-icons type="closeempty" size="22" color="#728178" /></button></view>
   <view class="sheet-body"><slot /></view>
  </view>
 </uni-popup>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String, busy: Boolean })
const emit = defineEmits(['close'])
const popup = ref(null), drag = ref(0), dragging = ref(false)
let origin, started
function sync() { if (!popup.value) return; if (props.open) { cancelDrag(); popup.value.open('bottom') } else popup.value.close() }
watch(() => props.open, sync)
onMounted(sync)
function changed(event) { if (!event.show && props.open) emit('close') }
function start(event) { if (props.busy || event.touches.length !== 1) return; origin = event.touches[0].clientY; started = Date.now(); dragging.value = true }
function move(event) { if (origin == null || event.touches.length !== 1) return; drag.value = Math.max(-12, event.touches[0].clientY - origin) }
function cancelDrag() { dragging.value = false; drag.value = 0; origin = null }
function end() {
 dragging.value = false
 if (origin == null) return
 const dismiss = drag.value > 80 || drag.value > 20 && drag.value / (Date.now() - started) > .5
 origin = null
 if (dismiss) emit('close')
 else drag.value = 0
}
</script>
<style scoped>
.sheet-body { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.sheet { width:100vw; max-height:92vh; display:flex; flex-direction:column; background:#fcfdfc; border-radius:16px 16px 0 0; overflow:hidden; padding-bottom:env(safe-area-inset-bottom); transition:transform 220ms cubic-bezier(.32,.72,0,1); box-shadow:0 -8px 32px #16372814; }.handle-zone { height:24px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }.handle { width:42px; height:5px; background:#c4cbc6; border-radius:5px; }.header { display:flex; align-items:center; justify-content:space-between; padding:4px 20px 16px; border-bottom:1px solid #e3e8e4; flex-shrink:0; }.header>view { min-width:0; }.title { display:block; font-size:19px; font-weight:600; color:#24382d; }.subtitle { display:block; font-size:12px; color:#78877e; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.close { margin:0; padding:0; width:44px; height:44px; line-height:44px; background:transparent; flex-shrink:0; }.close::after { border:0; }
</style>
