<template>
 <view class="agent-page">
  <!-- disabled 仅表示无会话可清；busy 时保留入口作逃生口（服务端 409 才是权威），
       否则 isRunning 卡死时用户没有任何自救手段（2026-09-17 预览整页失联） -->
  <AgentHeader :status="statusText" :disabled="!conversationId" :error="Boolean(errorMessage)" @clear="clearHistory" />
  <view class="conversation-shell">
   <scroll-view class="conversation" scroll-y enhanced :show-scrollbar="false" :scroll-into-view="scrollIntoView" @scroll="handleScroll" @scrolltolower="nearBottom = true">
   <view class="conversation__inner">
    <view v-if="!turns.length" class="welcome"><text>物联助手</text><view>告诉我位置、设备和需要的操作。</view></view>
    <view v-for="(turn, turnIndex) in turns" :key="turn.id" class="turn">
     <view class="user-row"><UserMessage class="um-host" :content="turn.content" :recoverable="canRecoverTurn(turn, turnIndex === turns.length - 1)" :disabled="busy" :editing="editingTurn === turn" @retry="retryTurn(turn)" @begin-edit="beginEdit(turn)" /></view>
     <AgentReplySurface :turn="turn" :busy="busy"
      @toggle-trace="turn.traceOpen = !turn.traceOpen" @select="selectDraft(turn, $event)"
      @confirm="confirmDraft(turn)" @cancel="cancelDraft(turn)" @revalidate="revalidateDraft(turn)"
      @updated="Object.assign(turn.draft, $event)" @editing="mutating = $event" @retry-answer="retryAnswer(turn)"
      @configure="openSheetEditor(turn, $event)" @browse="openSheetBrowser(turn)" />
    </view>
    <view v-if="errorMessage" class="error"><text>{{ errorMessage }}</text><button class="trace-toggle" @click="restore">重新连接</button></view>
    <view id="agent-bottom" class="anchor" />
   </view>
  </scroll-view>
  </view>
  <view class="composer-shell" :style="composerShellStyle"><AgentComposer ref="composer" v-model="input" :running="isRunning" :disabled="!conversationId || mutating || hasExecution" :editing="Boolean(editingTurn)" @send="onComposerSend" @voice="sendMessage" @stop="stopRun" @keyboard="onComposerKeyboard" @cancel-edit="cancelEdit" /></view>
  <DraftSheetLayer :draft="sheetDraft" :result="sheetTurn?.result ?? null" :browser="sheetBrowser" :current-action-id="sheetActionId" :open-request="sheetOpenRequest" :busy="busy" :baseline="sheetBaseline"
   :settle-selection="settleSelection"
   @close="closeSheet" @select="sheetTurn && selectDraft(sheetTurn, $event)" @confirm="sheetTurn && confirmDraft(sheetTurn)" @restore="sheetTurn && restoreDraft(sheetTurn)"
   @updated="sheetTurn && Object.assign(sheetTurn.draft, $event)" @editing="mutating = $event"
   @revalidate="sheetTurn && revalidateDraft(sheetTurn)" />
 </view>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { cancelAction, cancelRun, confirmAction, createConversation, restoreConversation, clearConversation, discardTurn, updateSelection, retrySummary, revalidateAction, restoreAction, streamMessage } from '@/apis/agent'
import { waitForAgentSession } from '@/utils/agent-session'
import { createTurn, applyEvent, restoreTurns, canRecoverTurn, restartTurn } from './conversation.mjs'
import { createDraftBaseline } from './action-draft-presentation.js'
import { createPresentation } from './presentation.mjs'
import AgentComposer from './components/AgentComposer.vue'
import AgentHeader from './components/AgentHeader.vue'
import AgentReplySurface from './components/AgentReplySurface.vue'
import DraftSheetLayer from './components/DraftSheetLayer.vue'
import UserMessage from './components/UserMessage.vue'
const conversationId = ref('')
const input = ref('')
const composer = ref(null)
const turns = ref([])
const errorMessage = ref('')
const isRunning = ref(false)
const phase = ref('')
const mutating = ref(false)
const scrollIntoView = ref('')
const nearBottom = ref(true)
const hasExecution = computed(() => turns.value.some(turn => turn.draft?.status === 'EXECUTING' || turn.result?.summary?.status === 'running'))
const busy = computed(() => isRunning.value || mutating.value || hasExecution.value)
const statusText = computed(() => !conversationId.value ? '正在连接' : busy.value ? '正在处理' : '服务在线')
const sheetDraftId = ref(''), sheetBrowser = ref(false), sheetActionId = ref(''), sheetOpenRequest = ref(0)
const sheetTurn = computed(() => turns.value.find(turn => turn.draft?.draftId === sheetDraftId.value) ?? null)
// 面板跟随轮次上的草案对象本身（含过期态）：过期不再踢掉面板，转只读 + 面板内重新核验；
// 仅当草案被新提案取代（draftId 消失）或轮次被清理时自动关闭。
const sheetDraft = computed(() => sheetTurn.value?.draft ?? null)
// 草案发布时刻的基线（勾选+指令）：面板「还原」按钮据此判断是否出现；权威还原在服务端。
const draftBaselines = new Map()
const sheetBaseline = computed(() => sheetTurn.value?.draft ? draftBaselines.get(sheetTurn.value.draft.draftId) ?? null : null)
function openSheetEditor(turn, action) {
 if (!action || action.kind !== 'ac' || !turn.draft) return
 sheetDraftId.value = turn.draft.draftId
 sheetBrowser.value = false
 sheetActionId.value = action.id
 sheetOpenRequest.value++
 uni.hideKeyboard()
}
// 更多设备浏览不受草案状态限制：过期/取消/已完成都可展开（只读）；仅要求草案存在
function openSheetBrowser(turn) {
 if (!turn.draft) return
 sheetDraftId.value = turn.draft.draftId
 sheetBrowser.value = true
 sheetActionId.value = ''
 sheetOpenRequest.value++
 uni.hideKeyboard()
}
function closeSheet() { sheetDraftId.value = '' }
let activeRequest, presentation, pollTimer, expiryTimer
let disposed = false, visible = true, restoring = false, sequence = 0
// 确认在途的 draftId 集合 + 纪元计数：确认请求本身即执行结果的权威通路，
// 期间 restore 整表回读会让路（服务端 EXECUTING 提交前的快照仍是待确认，
// 回读会把界面冻结成"幻觉待确认"）；纪元用于丢弃跨越确认起点的在途 restore 快照。
const confirming = new Set()
let confirmEpoch = 0
// 键盘停靠：adjust-position=false 页面不平移，键盘高度转为 composer-shell 底 padding
//（键盘高 + 8px 缝），对话区 flex 自动收缩；弹起时仅当用户本在底部才跟到底部锚点。
const kbHeight = ref(0), kbMs = ref(0)
const composerShellStyle = computed(() => ({ paddingBottom: kbHeight.value ? `${kbHeight.value + 8}px` : '', transitionDuration: `${kbMs.value}ms` }))
function onComposerKeyboard({ height, durationMs }) { kbHeight.value = height; kbMs.value = durationMs; if (height) follow() }
function follow(force = false) {
 if (!force && !nearBottom.value) return
 scrollIntoView.value = ''
 nextTick(() => { if (!disposed) scrollIntoView.value = 'agent-bottom' })
}
function handleScroll(event) { if (event.detail.deltaY > 5) nearBottom.value = false }
function schedule() {
 clearTimeout(pollTimer)
 if (visible && !disposed && (hasExecution.value || isRunning.value && !activeRequest)) pollTimer = setTimeout(restore, 1500)
 clearTimeout(expiryTimer)
 const pending = turns.value.filter(turn => turn.draft?.status === 'PENDING_CONFIRMATION')
 const deadline = Math.min(...pending.map(turn => Date.parse(turn.draft.expiresAt)))
 if (Number.isFinite(deadline)) expiryTimer = setTimeout(() => {
  if (mutating.value) return
  for (const turn of pending) if (turn.draft.status === 'PENDING_CONFIRMATION' && Date.parse(turn.draft.expiresAt) <= Date.now()) turn.draft.status = 'EXPIRED'
  schedule()
 }, Math.max(0, deadline - Date.now()))
}
watch(mutating, schedule)
watch(() => turns.value.map(turn => turn.draft ? turn.draft.draftId + turn.draft.status + turn.draft.expiresAt : '').join('|'), () => schedule())
async function restore() {
 if (restoring || activeRequest || confirming.size || disposed) return
 restoring = true
 const epoch = confirmEpoch
 try {
  await waitForAgentSession()
  const restored = await restoreConversation()
  const conversation = restored.conversation || await createConversation()
  if (disposed) return
  // 快照可能取于确认请求到达服务端之前（EXECUTING 提交前的待确认旧态）：
  // 跨越确认起点的快照整表丢弃，由确认结果写回或下一轮轮询收口。
  if (epoch !== confirmEpoch) { schedule(); return }
  conversationId.value = conversation.id
  phase.value = conversation.phase || 'idle'
  turns.value = restoreTurns(conversation.turns)
  for (const turn of turns.value) if (turn.draft && !draftBaselines.has(turn.draft.draftId)) {
   draftBaselines.set(turn.draft.draftId, createDraftBaseline(turn.draft))
   selectionSynced.set(turn.draft.draftId, turn.draft.selectedActionIds ?? [])
  }
  // 相位已持久化为服务端权威（含启动自愈），前端不再做僵死 running 的本地解锁。
  isRunning.value = Boolean(conversation.running)
  if (!isRunning.value) turns.value.forEach(turn => { turn.running = false })
  errorMessage.value = ''
  follow()
  schedule()
 } catch (error) { if (!disposed) { errorMessage.value = error.message; schedule() } }
 finally { restoring = false }
}
// 消息编辑收编进主输入框（全页面单一键盘链路）：进入编辑暂存 composer 草稿并预填原文，
// 取消/提交后还原草稿；编辑期间轮次被整表回读替换或失格时自动退出编辑态。
const editingTurn = ref(null)
let composerStash = ''
function beginEdit(turn) {
 if (busy.value || !canRecoverTurn(turn, turns.value.at(-1) === turn)) return
 composerStash = input.value
 editingTurn.value = turn
 input.value = turn.content
}
function cancelEdit() {
 if (!editingTurn.value) return
 editingTurn.value = null
 input.value = composerStash
 composerStash = ''
}
function onComposerSend() {
 const turn = editingTurn.value
 if (!turn) return sendMessage()
 const content = input.value.trim()
 editingTurn.value = null
 input.value = composerStash
 composerStash = ''
 const live = turns.value.find(item => item.id === turn.id)
 if (content && live && canRecoverTurn(live, turns.value.at(-1) === live)) return editTurn(live, content)
}
watch(turns, () => {
 const turn = editingTurn.value
 if (!turn) return
 const live = turns.value.find(item => item.id === turn.id)
 if (!live || !canRecoverTurn(live, turns.value.at(-1) === live)) return cancelEdit()
 editingTurn.value = live // 整表回读后重新钉到活对象，气泡高亮才不丢
})
async function sendMessage(voiceText) {
 const content = (typeof voiceText === 'string' ? voiceText : input.value).trim()
 if (!content || busy.value || !conversationId.value) return
 turns.value.push(createTurn('local-' + Date.now() + '-' + sequence++, content))
 const current = turns.value[turns.value.length - 1]
 if (typeof voiceText !== 'string') input.value = ''
 await runTurn(current, content)
}
async function runTurn(current, content) {
 isRunning.value = true
 errorMessage.value = ''
 follow(true)
 presentation = createPresentation(event => {
  if (disposed) return
  applyEvent(current, event)
  if (event.type === 'action.proposed') {
   draftBaselines.set(event.draftId, createDraftBaseline(event))
   selectionSynced.set(event.draftId, event.selectedActionIds ?? [])
   for (const previous of turns.value) if (previous !== current && previous.draft?.draftId === event.draftId) { previous.draft = null; previous.result = null }
  }
  if (event.type === 'action.resolved') for (const previous of turns.value) if (previous !== current && previous.draft?.draftId === event.draftId) previous.draft.status = event.status
  follow()
 })
 const request = streamMessage(conversationId.value, content, event => presentation.push(event))
 activeRequest = request
 let transportInterrupted = false
 try { await request.promise; await presentation.settle() }
 catch (error) {
  if (error.data?.code === 'CONVERSATION_AWAITING_CONFIRMATION') {
   // 相位门（执行中）：消息未进入服务端，撤回乐观轮次并回到服务端事实。
   const index = turns.value.indexOf(current)
   if (index >= 0) turns.value.splice(index, 1)
   uni.showToast({ title: '设备指令执行中，请稍候', icon: 'none' })
   if (!disposed) restore()
   return
  }
  if (error.transport) {
   // 断开≠取消：传输死了但服务端运行继续——保持进行中观感，交给 schedule 的
   // restore 轮询收尾（运行终态后完整回复/错误自然渲染进轮次），停止走 stopRun。
   transportInterrupted = true
  } else if (!disposed && current.running) current.error = error.message
 }
 finally {
  current.running = transportInterrupted
  isRunning.value = transportInterrupted
  activeRequest = null
  if (!disposed) schedule()
 }
}
async function recoverTurn(turn, content) {
 if (busy.value || !canRecoverTurn(turn, turns.value.at(-1) === turn)) return
 mutating.value = true
 // 未达服务端的失败轮没有 serverId，也没有可退役的服务端条目，直接重发即可。
 if (turn.serverId) {
  try { await discardTurn(conversationId.value, turn.serverId) }
  catch (error) { errorMessage.value = error.message; mutating.value = false; return }
 }
 mutating.value = false
 restartTurn(turn, content)
 await runTurn(turn, content)
}
function retryTurn(turn) { return recoverTurn(turn, turn.content) }
function editTurn(turn, content) { return recoverTurn(turn, content) }
// 点选不占 busy：本地勾选立即生效，PATCH 按 draftId 串行合并下发（latest-wins），
// 避免每次点选都让 busy 翻转、整个面板控件闪烁，且连点不再被守卫吞掉。
const selectionDesired = new Map(), selectionSynced = new Map(), selectionInflight = new Map()
const sameIds = (a, b) => a.length === b.length && a.every(id => b.includes(id))
const settleSelection = draftId => selectionInflight.get(draftId) ?? Promise.resolve()
function selectDraft(turn, selected) {
 // tap 事件携带的是渲染时刻的轮次对象；整表回读后它可能已成孤儿，先按 draftId 解析活对象。
 const live = liveDraftTurn(turn.draft?.draftId) ?? turn
 if (busy.value || live.draft?.status !== 'PENDING_CONFIRMATION') return
 if (Date.parse(live.draft.expiresAt) <= Date.now()) {
  live.draft.status = 'EXPIRED'
  uni.showToast({ title: '草案已过期，请重新核验', icon: 'none' })
  schedule()
  return
 }
 const draftId = live.draft.draftId
 live.draft.selectedActionIds = selected
 selectionDesired.set(draftId, selected)
 if (selectionInflight.has(draftId)) return
 selectionInflight.set(draftId, (async () => {
  try {
   while (selectionDesired.has(draftId)) {
    const live = liveDraftTurn(draftId)
    if (!live) break
    const desired = selectionDesired.get(draftId)
    selectionDesired.delete(draftId)
    if (sameIds(desired, selectionSynced.get(draftId) ?? [])) continue
    try {
     Object.assign(live.draft, await updateSelection(draftId, live.draft.revision, desired))
     selectionSynced.set(draftId, desired)
    } catch (error) {
     const synced = selectionSynced.get(draftId)
     const failed = liveDraftTurn(draftId)
     if (synced && failed) failed.draft.selectedActionIds = synced
     uni.showToast({ title: String(error.data?.message || error.message || '选择未保存').slice(0, 24), icon: 'none' })
     selectionDesired.delete(draftId)
     if (!activeRequest && !confirming.size && !disposed) await restore()
     break
    }
   }
  } finally { selectionInflight.delete(draftId); schedule() }
 })())
}
// 草案写回纪律：await 之后轮次可能已被整表回读替换，必须按 draftId 重解析活对象。
const liveDraftTurn = draftId => turns.value.find(item => item.draft?.draftId === draftId)
async function restoreDraft(turn) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION') return
 mutating.value = true
 const draftId = turn.draft.draftId
 await settleSelection(draftId)
 try {
  const updated = await restoreAction(draftId, (liveDraftTurn(draftId) ?? turn).draft?.revision ?? turn.draft.revision)
  const live = liveDraftTurn(draftId) ?? turn
  if (live.draft) Object.assign(live.draft, updated)
 } catch (error) {
  uni.showToast({ title: String(error.data?.message || error.message || '还原失败').slice(0, 24), icon: 'none' })
  if (!activeRequest && !confirming.size && !disposed) await restore()
 }
 finally { mutating.value = false; schedule() }
}
async function confirmDraft(turn) {
 if (busy.value || turn.draft?.status !== 'PENDING_CONFIRMATION') return
 const draftId = turn.draft.draftId
 mutating.value = true
 // 等选区同步落地再读 revision，避免确认到旧勾选
 await settleSelection(draftId)
 // settle 期间可能发生过整表回读：重新按 draftId 解析活轮次，不写闭包里的孤儿对象
 const current = turns.value.find(item => item.draft?.draftId === draftId) ?? turn
 if (current.draft?.status !== 'PENDING_CONFIRMATION' || !current.draft.selectedActionIds.length) { mutating.value = false; return }
 clearTimeout(expiryTimer)
 current.draft.status = 'EXECUTING'
 confirming.add(draftId)
 confirmEpoch++
 let resync = false
 try {
  const result = await confirmAction(draftId, current.draft.revision)
  const live = turns.value.find(item => item.draft?.draftId === draftId) ?? current
  live.result = result
  live.draft.status = result.status
 } catch (error) {
  const live = turns.value.find(item => item.draft?.draftId === draftId) ?? current
  if (['REJECTED', 'INTERRUPTED'].includes(error.data?.status)) { live.result = error.data; live.draft.status = error.data.status }
  else { errorMessage.value = error.message; resync = true }
 } finally { confirming.delete(draftId); mutating.value = false; schedule(); follow() }
 if (resync && !disposed) await restore()
}
async function cancelDraft(turn) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION') return
 mutating.value = true
 const draftId = turn.draft.draftId
 await settleSelection(draftId)
 try {
  const cancelled = await cancelAction(draftId)
  const live = liveDraftTurn(draftId) ?? turn
  if (live.draft) live.draft.status = cancelled.status
 } catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
async function revalidateDraft(turn) {
 if (busy.value || !turn.draft) return
 mutating.value = true
 const draftId = turn.draft.draftId
 await settleSelection(draftId)
 try {
  const live = liveDraftTurn(draftId) ?? turn
  if (live.draft) Object.assign(live.draft, await revalidateAction(draftId, live.draft.revision))
 } catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
async function retryAnswer(turn) {
 if (busy.value || !turn.draft) return
 mutating.value = true
 const draftId = turn.draft.draftId
 try {
  const summary = await retrySummary(draftId)
  const live = liveDraftTurn(draftId) ?? turn
  if (live.result) live.result.summary = summary
 } catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
async function stopRun() {
 const turn = turns.value[turns.value.length - 1]
 if (activeRequest) {
  presentation?.cancel()
  activeRequest.abort()
 }
 turn.running = false
 turn.error = '本次回答已停止'
 for (const item of turn.activities) if (['running', 'searching'].includes(item.status)) item.status = 'skipped'
 isRunning.value = false
 // 停止=显式取消：本地断流之外必须终止服务端在途运行（含断开重连轮询盯着的孤儿运行）。
 if (conversationId.value) {
  try { await cancelRun(conversationId.value) } catch { /* 无在途运行或未达服务端，以本地事实为准 */ }
  if (!disposed) restore()
 }
}
function clearHistory() {
 if (!conversationId.value) return
 uni.showModal({ title: '清除会话', content: '清除当前对话和草案记录？', success: async response => {
  if (!response.confirm) return
  mutating.value = true
  try {
   await clearConversation(conversationId.value)
   const fresh = await createConversation()
   conversationId.value = fresh.id
   turns.value = []
   draftBaselines.clear()
   errorMessage.value = ''
   follow(true)
  }
  catch (error) { errorMessage.value = error.message }
  finally { mutating.value = false }
 } })
}
onLoad(() => { restore() })
onShow(() => { visible = true; if (!activeRequest) restore() })
onHide(() => { visible = false; composer.value?.interrupt(); clearTimeout(pollTimer) })
onUnload(() => { disposed = true; clearTimeout(pollTimer); clearTimeout(expiryTimer); presentation?.cancel(); activeRequest?.abort() })
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.agent-page { height:100vh; display:flex; flex-direction:column; background:#f4f7f5; color:#24382d; }
.agent-status { display:flex; align-items:center; justify-content:space-between; padding:0 32rpx; min-height:72rpx; background:#fafcfb; border-bottom:1rpx solid #e0e7e2; color:#738278; font-size:23rpx; }
.clear { width:80rpx; height:72rpx; line-height:72rpx; padding:0; margin:0; background:transparent; }.clear::after { border:0; }
/* scroll-view 禁止直接用 flex:1/height:0 撑高（微信 webview 已知塌陷：盒子 0 高、
   内容被 enhanced 层画出但命中盒全灭——2026-09-17 预览"看得见点不中"根因）。
   确定性高度链：flex 包裹层 min-height:0 + 内层 scroll-view height:100%。 */
.conversation-shell { flex:1; min-height:0; overflow:hidden; }
.conversation { height:100%; }.conversation__inner { padding:24px 16px 32px; }
.welcome { margin:80rpx 0; font-size:36rpx; font-weight:600; }.welcome view { margin-top:20rpx; font-size:26rpx; font-weight:400; color:#738278; }
.turn { margin-bottom:42px; }.user-row { display:flex; justify-content:flex-end; margin-bottom:22px; }
/* 宿主必须定宽：组件宿主是 flex item、宽度靠内容反推，会让整条 fit-content 链塌到
   min-content（短消息每行一字）；定宽后气泡用 inline-block 收缩即可安全测量。 */
.user-row .um-host { width:100%; }
.trace-toggle { display:flex; align-items:center; gap:12rpx; padding:0; margin:12rpx 0; min-height:56rpx; line-height:56rpx; background:transparent; color:#738278; font-size:24rpx; }.trace-toggle::after { border:0; }
.error { display:block; margin-top:20rpx; color:#a66a13; font-size:25rpx; }
.composer-shell { position:relative; z-index:4; padding:8px 18px calc(14px + env(safe-area-inset-bottom)); background:transparent; flex-shrink:0; transition:padding-bottom .25s ease; }.anchor { height:2rpx; }
@media(prefers-reduced-motion:reduce){.composer-shell{transition:none;}}
</style>
