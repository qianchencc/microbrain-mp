<template>
 <view class="draft">
  <view class="heading"><text>{{ heading }}</text><text>{{ selected.length }}/{{ draft.actions.length }} 已选</text></view>
  <text v-if="pending && draft.question" class="note">{{ draft.question }}</text>
  <view v-for="action in draft.actions" :key="action.id" class="device" :class="{ selected: selected.includes(action.id), cancelled: draft.status === 'CANCELLED' }" @click="toggle(action.id)">
   <uni-icons :type="pending ? selected.includes(action.id) ? 'checkbox-filled' : 'circle' : 'gear'" size="21" color="#176b54" />
   <view class="body"><text class="name">{{ action.deviceName }}</text><text class="location">{{ action.location }}</text><text class="operation">{{ operationText(action) }}</text><text v-if="result" class="location">{{ outcome(action) }}</text></view>
  </view>
  <view v-if="pending" class="actions">
   <button class="quiet" :disabled="busy" @click="$emit('select', selected.length === draft.actions.length ? [] : draft.actions.map(action => action.id))">{{ selected.length === draft.actions.length ? '取消全选' : '全选' }}</button>
   <button class="quiet" :disabled="busy" @click="$emit('cancel')">取消</button>
   <button class="primary" :disabled="busy || !selected.length" :loading="busy" @click="$emit('confirm')">确认草案</button>
  </view>
  <button v-if="draft.status === 'EXPIRED'" class="quiet" :disabled="busy" @click="$emit('revalidate')">重新核验</button>
  <text v-if="result" class="note">{{ result.message }}</text>
 </view>
</template>
<script setup>
import { computed } from 'vue'
import { operationText, receiptText } from '../conversation.mjs'
const props = defineProps({ draft: { type: Object, required: true }, result: Object, busy: Boolean })
const emit = defineEmits(['confirm', 'cancel', 'select', 'revalidate'])
const pending = computed(() => props.draft.status === 'PENDING_CONFIRMATION')
const selected = computed(() => props.draft.selectedActionIds || [])
const heading = computed(() => ({ PENDING_CONFIRMATION: '待确认操作', EXECUTING: '正在执行', CANCELLED: '草案已取消', EXPIRED: '草案已过期', NO_CHANGE: '无需操作' }[props.draft.status] || '执行结果'))
function toggle(id) {
 if (!pending.value || props.busy) return
 emit('select', selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id])
}
function outcome(action) {
 return receiptText(props.result?.receipts?.find(receipt => receipt.actionId === action.id)) || (selected.value.includes(action.id) ? receiptText({ outcome: props.result?.status }) : '未选择')
}
</script>
<style scoped>
.draft { margin-top:24rpx; padding:20rpx 20rpx 18rpx; border-radius:14rpx; background:rgba(23,107,84,.05); border:1rpx solid rgba(23,107,84,.13); box-shadow:inset 0 2rpx 6rpx rgba(84,68,32,.07); }
.heading { display:flex; justify-content:space-between; gap:16rpx; font-size:24rpx; color:#5c6f64; }
.note { display:block; margin-top:20rpx; font-size:26rpx; line-height:1.7; color:#22332a; }
.device { display:flex; align-items:flex-start; padding:20rpx 16rpx; margin-top:14rpx; border:1rpx solid #d5cbb0; border-radius:12rpx;
 background:linear-gradient(180deg,#fdfbf4,#f6f0e0); box-shadow:inset 0 1rpx 0 rgba(255,255,255,.7); }
.selected { border-color:#3e8767; background:linear-gradient(180deg,#eef7f0,#e2efe6); box-shadow:inset 0 2rpx 5rpx rgba(23,107,84,.14); }
.cancelled .operation { text-decoration:line-through; color:#89958e; }
.body { flex:1; min-width:0; margin-left:16rpx; }.body text { display:block; overflow-wrap:break-word; }
.name { font-size:27rpx; font-weight:600; line-height:1.5; color:#22332a; }.location { font-size:23rpx; color:#75857a; margin-top:6rpx; }
.operation { font-size:25rpx; color:#1c6b50; margin-top:10rpx; font-weight:600; }.actions { display:flex; align-items:center; gap:12rpx; margin-top:20rpx; }
button { margin:0; font-size:25rpx; border-radius:999rpx; min-height:76rpx; line-height:76rpx; }button::after { border:0; }
.quiet { background:linear-gradient(180deg,#fbf8f0,#e8e0cb); color:#55685c; border:1rpx solid #c6b998; padding:0 24rpx;
 box-shadow:inset 0 1rpx 0 rgba(255,255,255,.8), 0 3rpx 6rpx rgba(4,16,11,.2); }.quiet:active { box-shadow:inset 0 3rpx 6rpx rgba(74,60,28,.22); }
.primary { flex:1; color:#f2f7f4; background:linear-gradient(180deg,#2f8f6b 0%,#1c6b50 60%,#175743 100%); border:1rpx solid #0f3f2d;
 box-shadow:inset 0 2rpx 2rpx rgba(255,255,255,.25), inset 0 -4rpx 8rpx rgba(0,0,0,.22), 0 8rpx 18rpx rgba(6,26,18,.4); }
.primary:active { box-shadow:inset 0 4rpx 10rpx rgba(0,0,0,.35); }
.primary[disabled] { background:linear-gradient(180deg,#9db8ab,#7d9a8c); border-color:#68816f; color:#c4d2ca; }
</style>
