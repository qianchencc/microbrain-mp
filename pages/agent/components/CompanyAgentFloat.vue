<template>
 <view class="agent-float">
  <view class="float-scrim" :class="{ on: open }" @tap="collapse" />
  <view v-if="mounted" class="float-panel" :class="{ open }" :style="{ top: panelTop + 'px' }">
   <view class="panel-head">
    <view class="panel-id"><text class="panel-name">公司 Agent</text><text class="panel-status">{{ status }}</text></view>
    <button class="panel-menu" aria-label="会话菜单" hover-class="panel-menu--pressed" @tap="conv?.openMenu()"><uni-icons type="more-filled" size="17" color="#536b5c" /></button>
   </view>
   <AgentConversation ref="conv" class="panel-conv" source="company" :active="open && pageActive"
    @status="value => status = value" @running="onRunning" @connected="value => connected = value"
    @tasks-changed="$emit('tasks-changed')" @inbox-count="value => inboxCount = value" @error="value => hasError = value" @unread="unread++" />
  </view>
  <view class="float-orb" :class="{ docked: open, working: running && !open }" :style="orbStyle" role="button" :aria-label="open ? '收起公司 Agent' : '打开公司 Agent'" hover-class="float-orb--pressed" @tap="toggle">
   <AgentAvatar class="orb-avatar" :running="running" />
   <view v-if="unread && !open" class="orb-badge"><text>{{ unread > 9 ? '9+' : unread }}</text></view>
   <view v-if="!open && !hinted" class="orb-hint"><text class="orb-hint-text">问公司 Agent</text></view>
  </view>
 </view>
</template>
<script setup>
// 公司 Agent 浮层宿主（B 方案收口）：
// 右下角常驻 orb → 全宽底片面板底部向上展开（顶部透出仪表盘），
// 展开后 orb 缩小停靠面板右上角沿、兼任收起把手；点遮罩同样收起。
// 收起是最小化：面板保持挂载、在途流继续跑；orb 给运行中环/未读角标。
// 键盘零专门处理——输入区走 AgentComposer 的 adjust-position=false + keyboard-dock。
import { computed, nextTick, ref, watch } from 'vue'
import AgentAvatar from './AgentAvatar.vue'
import AgentConversation from './AgentConversation.vue'
import { navMetrics } from '../lib/navigation.mjs'

// pageActive 由宿主页转发（onShow/onHide）：页面被 navigateTo 压栈时
// 会话等价收起——保草稿停轮询、在途流继续。
defineProps({ pageActive: Boolean })
defineEmits(['tasks-changed'])

const metrics = navMetrics()
const winInfo = uni.getWindowInfo()
// 面板顶沿贴在自定义导航下（仪表盘标题与返回保持可见）
const panelTop = metrics.top + metrics.barHeight + 8

const open = ref(false), mounted = ref(false), hinted = ref(false)
const status = ref('正在连接'), running = ref(false), connected = ref(false)
const unread = ref(0), inboxCount = ref(0), hasError = ref(false)
const conv = ref(null)

// orb 常驻右下（避让底部安全区）；展开时平移+缩小到面板顶右沿。
// 位移按窗高实算：orb 中心 → (W-22, panelTop+2)。
const orbStyle = computed(() => {
 if (!open.value) return {}
 const safeBottom = winInfo.safeAreaInsets?.bottom || 0
 const centerY = winInfo.windowHeight - 16 - safeBottom - 28
 const dy = panelTop + 2 - centerY
 return { transform: `translate(20px, ${dy}px) scale(.62)` }
})

let pendingPayload = null
function deliver(payload) {
 if (!payload) return
 // 引用/预填交给会话组件：未 hydration 时内部自动转暂存队列
 if (payload.reference) conv.value?.setReference(payload.reference)
 if (payload.prompt) conv.value?.prefill(payload.prompt)
}
// 小程序子组件要等 setData 往返后才拿得到实例；深链在页面 onMounted 就打开浮层，
// 引用/预填必须暂存到 conv 真正挂载再交付，不能静默丢弃。
watch(conv, value => {
 if (!value || !pendingPayload) return
 const payload = pendingPayload
 pendingPayload = null
 deliver(payload)
})
async function openPanel(payload = {}) {
 hinted.value = true
 unread.value = 0
 if (!mounted.value) mounted.value = true
 open.value = true
 await nextTick()
 if (conv.value) deliver(payload)
 else pendingPayload = payload
}
function collapse() { open.value = false }
function toggle() { if (open.value) collapse(); else openPanel() }
// 未读角标只由会话组件的 unread 事件累加（回复落定/后台新轮次），
// running 回落本身不计数——失败或中断的运行不该亮"有新回复"。
function onRunning(value) { running.value = value }
defineExpose({ open: openPanel, close: collapse, toggle, isOpen: open })
</script>
<style scoped>
/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }

/* 层级约定：浮层 40~46，全部低于 DeviceSheet 根（z99）——从面板内打开的
   安全台账/任务详情等 Sheet 以视口 fixed 盖在浮层之上。 */
.float-scrim { position:fixed; inset:0; z-index:40; background:rgba(22,38,30,.34); opacity:0; pointer-events:none; transition:opacity .3s ease; }
.float-scrim.on { opacity:1; pointer-events:auto; }

.float-panel { position:fixed; z-index:45; left:0; right:0; bottom:0; display:flex; flex-direction:column;
 border-radius:18px 18px 0 0; background:linear-gradient(180deg,#fbfcfb,#f2f6f3);
 box-shadow:0 -14px 44px rgba(26,55,43,.26); overflow:hidden;
 transform:translate(30%,30%) scale(.52); transform-origin:92% 100%; opacity:0; pointer-events:none;
 transition:transform .42s cubic-bezier(.2,.9,.25,1), opacity .3s ease; }
.float-panel.open { transform:none; opacity:1; pointer-events:auto; }

.panel-head { display:flex; align-items:center; gap:9px; padding:12px 46px 11px 14px; flex-shrink:0; border-bottom:1px solid #e4eae4; }
.panel-id { flex:1; min-width:0; display:flex; flex-direction:column; }
.panel-name { font-size:14px; font-weight:600; color:#293f31; line-height:1.3; }
.panel-status { font-size:10.5px; color:#7d8d82; line-height:1.4; }
.panel-menu { width:36px; height:36px; display:flex; align-items:center; justify-content:center; margin:0; padding:0; background:transparent; border-radius:12px; flex-shrink:0; }
.panel-menu::after { border:0; }
.panel-menu--pressed { background:#e7eee8; }
.panel-conv { flex:1; min-height:0; display:flex; }

/* orb 用 view 不用 button：微信 button 默认 overflow:hidden 会把子元素裁进
   圆角盒内——角标/提示气泡挂在盒外会被裁掉（角标只露圆内一弯月牙、hint 完全不显示） */
.float-orb { position:fixed; z-index:46; right:14px; bottom:calc(16px + env(safe-area-inset-bottom));
 width:56px; height:56px; margin:0; padding:5px; border-radius:50%;
 display:flex; align-items:center; justify-content:center;
 background:linear-gradient(160deg,#fefefb,#eef3ef);
 box-shadow:0 6px 20px rgba(24,60,40,.22), inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 .5px rgba(26,55,43,.12);
 transition:transform .44s cubic-bezier(.2,.9,.25,1), box-shadow .3s ease; }
.float-orb--pressed { transform:scale(.94); }
.float-orb.docked { box-shadow:0 4px 14px rgba(24,60,40,.18), inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 .5px rgba(26,55,43,.12); }
.orb-avatar { transform:scale(1.4); }
/* 运行中：玉绿呼吸环 */
.float-orb.working { box-shadow:0 6px 20px rgba(24,60,40,.22), 0 0 0 0 rgba(44,122,92,.4); animation:orb-breathe 1.9s ease-in-out infinite; }
@keyframes orb-breathe { 50% { box-shadow:0 6px 20px rgba(24,60,40,.22), 0 0 0 5px rgba(44,122,92,0); } }
.orb-badge { position:absolute; top:-2px; right:-2px; min-width:19px; height:19px; padding:0 5px; border-radius:10px; box-sizing:border-box;
 display:flex; align-items:center; justify-content:center;
 background:linear-gradient(160deg,#c9a55c,#a8843f); color:#fff; font-size:10.5px; font-weight:600;
 box-shadow:0 2px 6px rgba(120,88,30,.35); }
.orb-hint { position:absolute; right:64px; top:50%; transform:translateY(-50%); padding:7px 12px; border-radius:12px;
 background:linear-gradient(#fefffe,#f3f7f4); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.14), 0 4px 14px rgba(28,57,42,.12); white-space:nowrap; }
.orb-hint::after { content:''; position:absolute; right:-4px; top:50%; width:9px; height:9px; margin-top:-5px; transform:rotate(45deg); background:#f7faf7; box-shadow:inset -1px 1px 0 rgba(26,55,43,.1); }
.orb-hint-text { font-size:12px; color:#3d5848; }
@media(prefers-reduced-motion:reduce){ .float-panel,.float-orb{transition:none;} .float-orb.working{animation:none;} }
</style>
