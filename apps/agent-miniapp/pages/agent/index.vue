<template>
 <view class="agent-page" :style="{ height: keyboardHeight ? `calc(100vh - ${keyboardHeight}px)` : '100vh' }">
  <!-- disabled 仅表示无会话可清；busy 时保留入口作逃生口（服务端 409 才是权威），
       否则 isRunning 卡死时用户没有任何自救手段（2026-09-17 预览整页失联） -->
  <AgentHeader :status="statusText" :disabled="!conversationId" :error="Boolean(errorMessage)" @clear="clearHistory" />
  <scroll-view class="conversation" scroll-y enhanced :show-scrollbar="false" :scroll-into-view="scrollIntoView" @scroll="handleScroll" @scrolltolower="nearBottom = true">
   <view class="conversation__inner">
    <view v-if="!turns.length" class="welcome"><text>物联助手</text><view>告诉我位置、设备和需要的操作。</view></view>
    <view v-for="(turn, turnIndex) in turns" :key="turn.id" class="turn">
     <view class="user-row"><UserMessage :content="turn.content" :recoverable="canRecoverTurn(turn, turnIndex === turns.length - 1)" :disabled="busy" @retry="retryTurn(turn)" @edit="editTurn(turn, $event)" /></view>
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
  <view class="composer-shell" :style="keyboardHeight ? {paddingBottom:'8px'} : {}"><AgentComposer ref="composer" v-model="input" :running="isRunning" :disabled="!conversationId || mutating || hasExecution" @keyboard="applyKeyboardHeight" @send="sendMessage" @voice="sendMessage" @stop="stopRun" /></view>
  <DraftSheetLayer :draft="sheetDraft" :result="sheetTurn?.result ?? null" :browser="sheetBrowser" :current-action-id="sheetActionId" :busy="busy"
   @close="closeSheet" @select="sheetTurn && selectDraft(sheetTurn, $event)" @confirm="sheetTurn && confirmDraft(sheetTurn)"
   @updated="sheetTurn && Object.assign(sheetTurn.draft, $event)" @editing="mutating = $event"
   @revalidate="sheetTurn && revalidateDraft(sheetTurn)" />
 </view>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { cancelAction, confirmAction, createConversation, restoreConversation, clearConversation, discardTurn, updateSelection, retrySummary, revalidateAction, streamMessage } from '@/apis/agent'
import { createTurn, applyEvent, restoreTurns, canRecoverTurn, restartTurn } from './conversation.mjs'
import { createPresentation } from './presentation.mjs'
import AgentComposer from './components/AgentComposer.vue'
import AgentHeader from './components/AgentHeader.vue'
import AgentReplySurface from './components/AgentReplySurface.vue'
import DraftSheetLayer from './components/DraftSheetLayer.vue'
import UserMessage from './components/UserMessage.vue'
const conversationId = ref('')
const input = ref('')
const composer = ref(null)
const keyboardHeight = ref(0)
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
const sheetDraftId = ref(''), sheetBrowser = ref(false), sheetActionId = ref('')
const sheetTurn = computed(() => turns.value.find(turn => turn.draft?.draftId === sheetDraftId.value) ?? null)
// 面板跟随轮次上的草案对象本身（含过期态）：过期不再踢掉面板，转只读 + 面板内重新核验；
// 仅当草案被新提案取代（draftId 消失）或轮次被清理时自动关闭。
const sheetDraft = computed(() => sheetTurn.value?.draft ?? null)
function openSheetEditor(turn, action) {
 if (!action || !turn.draft) return
 sheetDraftId.value = turn.draft.draftId
 sheetBrowser.value = false
 sheetActionId.value = action.id
 uni.hideKeyboard()
}
// 更多设备浏览不受草案状态限制：过期/取消/已完成都可展开（只读）；仅要求草案存在
function openSheetBrowser(turn) {
 if (!turn.draft) return
 sheetDraftId.value = turn.draft.draftId
 sheetBrowser.value = true
 sheetActionId.value = ''
 uni.hideKeyboard()
}
function closeSheet() { sheetDraftId.value = '' }
let activeRequest, presentation, pollTimer, expiryTimer
let disposed = false, visible = true, restoring = false, sequence = 0
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
 if (restoring || activeRequest || disposed) return
 restoring = true
 try {
  const restored = await restoreConversation()
  const conversation = restored.conversation || await createConversation()
  if (disposed) return
  conversationId.value = conversation.id
  phase.value = conversation.phase || 'idle'
  turns.value = restoreTurns(conversation.turns)
  // 相位已持久化为服务端权威（含启动自愈），前端不再做僵死 running 的本地解锁。
  isRunning.value = Boolean(conversation.running)
  if (!isRunning.value) turns.value.forEach(turn => { turn.running = false })
  errorMessage.value = ''
  follow()
  schedule()
 } catch (error) { if (!disposed) { errorMessage.value = error.message; schedule() } }
 finally { restoring = false }
}
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
  if (event.type === 'action.proposed') for (const previous of turns.value) if (previous !== current && previous.draft?.draftId === event.draftId) { previous.draft = null; previous.result = null }
  if (event.type === 'action.resolved') for (const previous of turns.value) if (previous !== current && previous.draft?.draftId === event.draftId) previous.draft.status = event.status
  follow()
 })
 const request = streamMessage(conversationId.value, content, event => presentation.push(event))
 activeRequest = request
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
  if (!disposed && current.running) current.error = error.message
 }
 finally { current.running = false; isRunning.value = false; activeRequest = null; if (!disposed) schedule() }
}
async function recoverTurn(turn, content) {
 if (busy.value || !canRecoverTurn(turn, turns.value.at(-1) === turn)) return
 mutating.value = true
 try { await discardTurn(conversationId.value, turn.serverId) }
 catch (error) { errorMessage.value = error.message; mutating.value = false; return }
 mutating.value = false
 restartTurn(turn, content)
 await runTurn(turn, content)
}
function retryTurn(turn) { return recoverTurn(turn, turn.content) }
function editTurn(turn, content) { return recoverTurn(turn, content) }
async function selectDraft(turn, selected) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION') return
 if (Date.parse(turn.draft.expiresAt) <= Date.now()) {
  turn.draft.status = 'EXPIRED'
  uni.showToast({ title: '草案已过期，请重新核验', icon: 'none' })
  schedule()
  return
 }
 const previous = turn.draft.selectedActionIds
 turn.draft.selectedActionIds = selected
 mutating.value = true
 try { Object.assign(turn.draft, await updateSelection(turn.draft.draftId, turn.draft.revision, selected)) }
 catch (error) {
  turn.draft.selectedActionIds = previous
  uni.showToast({ title: String(error.data?.message || error.message || '选择未保存').slice(0, 24), icon: 'none' })
  if (!activeRequest && !disposed) { mutating.value = false; await restore() }
 }
 finally { mutating.value = false; schedule() }
}
async function confirmDraft(turn) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION' || !turn.draft.selectedActionIds.length) return
 mutating.value = true
 clearTimeout(expiryTimer)
 turn.draft.status = 'EXECUTING'
 try { turn.result = await confirmAction(turn.draft.draftId, turn.draft.revision); turn.draft.status = turn.result.status }
 catch (error) {
  if (error.data?.status === 'REJECTED') { turn.result = error.data; turn.draft.status = 'REJECTED' }
  else { errorMessage.value = error.message; await restore() }
 } finally { mutating.value = false; schedule(); follow() }
}
async function cancelDraft(turn) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION') return
 mutating.value = true
 try { turn.draft.status = (await cancelAction(turn.draft.draftId)).status }
 catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
async function revalidateDraft(turn) {
 if (busy.value) return
 mutating.value = true
 try { Object.assign(turn.draft, await revalidateAction(turn.draft.draftId, turn.draft.revision)) }
 catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
async function retryAnswer(turn) {
 if (busy.value) return
 mutating.value = true
 try { turn.result.summary = await retrySummary(turn.draft.draftId) }
 catch (error) { errorMessage.value = error.message }
 finally { mutating.value = false; schedule() }
}
function stopRun() {
 if (!activeRequest) return
 const turn = turns.value[turns.value.length - 1]
 turn.running = false
 turn.error = '本次回答已停止'
 for (const item of turn.activities) if (['running', 'searching'].includes(item.status)) item.status = 'skipped'
 presentation?.cancel()
 activeRequest.abort()
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
   errorMessage.value = ''
   follow(true)
  }
  catch (error) { errorMessage.value = error.message }
  finally { mutating.value = false }
 } })
}
let keyboardCloseTimer
// 页面高度收缩只补偿输入栏（composer textarea 关闭了系统 adjust-position）；
// 不能挂 uni.onKeyboardHeightChange 全局监听——编辑器内的 textarea 依赖系统上推，
// 全局监听会让两者叠加，模拟器里表现为页面被压短、底部留出黑洞。
function applyKeyboardHeight(height) {
 if (disposed) return
 clearTimeout(keyboardCloseTimer)
 // 输入法面板切换会先报 0 再报真实高度，0 需要短暂确认，避免页面高度来回跳动
 if (height > 0) keyboardHeight.value = height
 else keyboardCloseTimer = setTimeout(() => { if (!disposed) keyboardHeight.value = 0 }, 120)
 follow()
}
onLoad(() => { restore() })
onShow(() => { visible = true; if (conversationId.value && !activeRequest) restore() })
onHide(() => { visible = false; composer.value?.interrupt(); clearTimeout(pollTimer) })
onUnload(() => { disposed = true; clearTimeout(pollTimer); clearTimeout(expiryTimer); clearTimeout(keyboardCloseTimer); presentation?.cancel(); activeRequest?.abort() })
</script>
<style scoped>
.agent-page { height:100vh; display:flex; flex-direction:column; background:#f4f7f5; color:#24382d; transition:height 200ms ease-out; }
.agent-status { display:flex; align-items:center; justify-content:space-between; padding:0 32rpx; min-height:72rpx; background:#fafcfb; border-bottom:1rpx solid #e0e7e2; color:#738278; font-size:23rpx; }
.clear { width:80rpx; height:72rpx; line-height:72rpx; padding:0; margin:0; background:transparent; }.clear::after { border:0; }
.conversation { flex:1; height:0; min-height:0; }.conversation__inner { padding:24px 16px 32px; }
.welcome { margin:80rpx 0; font-size:36rpx; font-weight:600; }.welcome view { margin-top:20rpx; font-size:26rpx; font-weight:400; color:#738278; }
.turn { margin-bottom:42px; }.user-row { display:flex; justify-content:flex-end; margin-bottom:22px; }
.trace-toggle { display:flex; align-items:center; gap:12rpx; padding:0; margin:12rpx 0; min-height:56rpx; line-height:56rpx; background:transparent; color:#738278; font-size:24rpx; }.trace-toggle::after { border:0; }
.error { display:block; margin-top:20rpx; color:#a66a13; font-size:25rpx; }
.composer-shell { position:relative; z-index:0; padding:8px 12px calc(8px + env(safe-area-inset-bottom)); background:linear-gradient(180deg,#f4f7f5,#f9fbf9); flex-shrink:0; transition:padding-bottom 200ms ease-out; }.anchor { height:2rpx; }
</style>
