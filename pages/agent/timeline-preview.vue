<template>
 <view class="preview"><view class="switch"><button size="mini" @tap="renderer = renderer === 'canvas' ? 'svg' : 'canvas'">{{ renderer }} · 切换</button><button size="mini" @tap="now = now.includes('14:45') ? '2026-09-24T15:42:00+08:00' : '2026-09-24T14:45:00+08:00'">{{ now.slice(11,16) }}</button></view><view class="body"><RegionTimeline :key="renderer" :renderer="renderer" date="2026-09-24" :now="now" :items="items" :days="2" @select="selected = $event.label" /></view><text class="selected">{{ selected }}</text></view>
</template>
<script setup>
import { ref } from 'vue'
import RegionTimeline from './components/RegionTimeline.vue'
const renderer = ref('canvas')
const now = ref('2026-09-24T14:45:00+08:00')
const selected = ref('点击任务卡验证普通视图响应')
const items = [{ id:'point', at:'2026-09-24T08:45:00+08:00', label:'晨间照明', faded:true }, {id:'meeting',at:'2026-09-24T14:00:00+08:00',endAt:'2026-09-24T15:30:00+08:00',label:'会议准备'}, {id:'night',at:'2026-09-24T18:00:00+08:00',label:'下班关灯'}, {id:'tomorrow',at:'2026-09-25T08:45:00+08:00',label:'次日照明'}]
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.preview { height:100vh; display:flex; flex-direction:column; background:#f4f7f5; }
.switch { display:flex; gap:10px; padding:10px; }
.body { flex:1; min-height:0; margin:0 16px; }
.selected { padding:10px 20px; font-size:12px; color:#45564d; }
</style>
