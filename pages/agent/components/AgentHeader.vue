<template>
 <view class="header" :style="{ paddingTop: top + 'px' }">
  <view class="native-bar" :style="{ height: barHeight + 'px', paddingRight: rightInset + 'px' }">
   <button class="identity" aria-label="物联 Agent，会话菜单" hover-class="identity--pressed" @tap="openMenu">
    <view class="mark"><image src="/static/sparkles.svg" /></view>
    <view class="dot" :class="{ 'dot--error': error, 'dot--working': status !== '服务在线' }" :aria-label="status" />
    <uni-icons type="down" size="11" color="#87958d" />
   </button>
   <view class="nav-chip"><slot /></view>
  </view>
  <view v-if="error" class="connection"><text>连接暂时中断，请稍后重试</text></view>
 </view>
</template>
<script setup>
const props = defineProps({ status: String, disabled: Boolean, error: Boolean })
const emit = defineEmits(['clear'])
import { navMetrics } from '../nav-metrics.js'

const { top, barHeight, rightInset } = navMetrics()
function openMenu() {
 if (props.disabled) {
  uni.showToast({ title: '暂无可清除的会话', icon: 'none' })
  return
 }
 uni.showActionSheet({ itemList: ['清除当前会话'], success: ({ tapIndex }) => { if (tapIndex === 0) emit('clear') } })
}
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.header { flex-shrink:0; background:linear-gradient(180deg,#fcfdfc,#f4f7f5); border-bottom:1px solid rgba(44,75,58,.05); }
.native-bar { display:flex; align-items:center; padding-left:16px; box-sizing:border-box; min-height:44px; }
.nav-chip { flex:1; min-width:0; display:flex; justify-content:center; align-items:center; }
.identity { display:flex; align-items:center; gap:8px; min-height:44px; padding:0; margin:0; background:transparent; line-height:1.2; border-radius:12px; text-align:left; transition:transform 140ms cubic-bezier(.23,1,.32,1); }
.identity::after { border:0; }.identity--pressed { transform:scale(.97); }
.mark { width:28px; height:28px; flex-shrink:0; border-radius:9px; background:linear-gradient(145deg,#308b70,#11553f); border:1px solid rgba(14,70,50,.2); box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 4px rgba(21,74,51,.12); display:flex; align-items:center; justify-content:center; }
.mark image { width:19px; height:19px; filter:brightness(0) invert(1); }
.dot { width:5px; height:5px; flex-shrink:0; border-radius:50%; background:#31866a; box-shadow:0 0 0 2px #e4eee8; }
.dot--working { background:#8c9c93; box-shadow:0 0 0 2px #e8edea; }.dot--error { background:#ad711b; box-shadow:0 0 0 2px #f4eadc; }
.connection { padding:3px 16px 8px; font-size:11px; color:#96672f; }
</style>
