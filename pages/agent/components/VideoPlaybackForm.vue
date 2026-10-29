<template>
 <view class="playback-form">
  <text class="camera">{{ device.name }}</text><text class="location">{{ device.location }}</text>
  <text class="caption">录像开始 · 上海时间</text>
  <view class="pickers"><picker mode="date" :value="dates.fromDate" @change="dates.fromDate = $event.detail.value"><view>{{ dates.fromDate }} <uni-icons type="down" size="10" color="#69806b" /></view></picker><picker mode="time" :value="dates.fromTime" @change="dates.fromTime = $event.detail.value"><view>{{ dates.fromTime }} <uni-icons type="down" size="10" color="#69806b" /></view></picker></view>
  <text class="caption">录像结束</text>
  <view class="pickers"><picker mode="date" :value="dates.toDate" @change="dates.toDate = $event.detail.value"><view>{{ dates.toDate }} <uni-icons type="down" size="10" color="#69806b" /></view></picker><picker mode="time" :value="dates.toTime" @change="dates.toTime = $event.detail.value"><view>{{ dates.toTime }} <uni-icons type="down" size="10" color="#69806b" /></view></picker></view>
  <text class="note">单次最长三天</text>
  <text v-if="error" class="error">{{ error }}</text>
  <button class="open-recording" :disabled="!ready || busy" hover-class="pressed" @tap="open">{{ ready ? '查看这段录像' : '播放页接入中' }} <uni-icons type="right" size="12" color="#fff" /></button>
 </view>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { defaultPlaybackDates, playbackDates, playbackWindowDates } from '../lib/observations.mjs'
const props = defineProps({ device: { type: Object, required: true }, ready: Boolean, busy: Boolean })
const emit = defineEmits(['open'])
const dates = reactive(props.device.beginTime && props.device.endTime ? playbackWindowDates(props.device) : defaultPlaybackDates()), error = ref('')
function open() { error.value = ''; try { emit('open', playbackDates(dates)) } catch (cause) { error.value = cause.message } }
</script>
<style scoped>
view,text { font-size:inherit;line-height:inherit; }.playback-form { padding:0 20px 24px;font-size:12px;color:#476850; }.camera,.location,.caption,.note,.error { display:block; }.camera { font-weight:600;font-size:15px; }.location { margin-top:5px;color:#8b9e85;font-size:11px; }.caption { margin:22px 0 8px;font-size:11px;color:#82947b; }.pickers { display:flex;gap:10px; }.pickers picker { flex:1; }.pickers view { min-height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border:1px solid #dce6d7;border-radius:9px;background:linear-gradient(145deg,#fcfdf8,#f0f6eb); }.note { color:#8e9d87;font-size:11px;line-height:1.7;margin-top:18px; }.error { color:#9e792d;margin-top:12px; }.open-recording { margin:22px 0 0;padding:0;min-height:46px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;background:linear-gradient(155deg,#2c8367,#16583f);box-shadow:inset 0 1px 0 #91b3a050,0 4px 10px -6px #1b573d80;color:white;font-size:13px;line-height:1.3; }.open-recording::after { border:0; }.open-recording[disabled] { opacity:.45;color:white; }.pressed { opacity:.75; }
</style>
