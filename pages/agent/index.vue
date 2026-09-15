<template>
 <view class="agent-page">
  <view class="agent-status">
   <view class="agent-status__lamp" :class="{ 'agent-status__lamp--busy': busy }" />
   <text class="agent-status__text">{{ statusText }}</text>
   <button class="clear" :disabled="busy || !conversationId" aria-label="清除会话" @click="clearHistory"><uni-icons type="trash" size="20" color="#cfe0d6" /></button>
  </view>
  <scroll-view class="conversation" scroll-y :scroll-into-view="scrollIntoView" @scroll="handleScroll" @scrolltolower="nearBottom = true">
   <view class="conversation__inner">
    <view v-if="!turns.length" class="welcome">
     <view class="welcome__plaque">
      <text class="welcome__title">物联助手</text>
      <text class="welcome__sub">告诉我位置、设备和需要的操作。</text>
     </view>
    </view>
    <view v-for="(turn, index) in turns" :key="turn.id" class="turn">
     <view class="user-row">
      <view v-if="isLastTurn(index) && !turn.running && !editingId" class="user-tools">
       <button class="chip" :disabled="busy" @click="retryTurn(turn)">重试</button>
       <button class="chip" :disabled="busy" @click="startEdit(turn)">编辑</button>
      </view>
      <view v-if="editingId === turn.id" class="user-edit">
       <textarea v-model="editDraft" class="user-edit__input" :auto-height="true" :maxlength="200" placeholder="修改后重新发送" placeholder-class="user-edit__placeholder" />
       <view class="user-edit__actions">
        <button class="chip" @click="cancelEdit">取消</button>
        <button class="chip chip--primary" :disabled="!editDraft.trim()" @click="resendEdit">发送</button>
       </view>
      </view>
      <text v-else class="user-message">{{ turn.content }}</text>
     </view>
     <view class="agent-card">
      <view class="agent-heading">
       <view class="agent-avatar" aria-hidden="true"><text>″</text></view>
       <text class="agent-heading__name">物联 Agent</text>
       <view v-if="turn.running && !turn.text" class="thinking"><view class="thinking__dot" /><text>思考中</text></view>
      </view>
      <button v-if="turn.activities.length" class="trace-toggle" @click="turn.traceOpen = !turn.traceOpen"><text>处理记录</text><uni-icons :type="turn.traceOpen ? 'up' : 'down'" size="13" color="#7d9084" /></button>
      <ToolActivity v-if="turn.traceOpen" :items="turn.activities" />
      <view v-if="turn.text" class="answer">
       <rich-text v-if="!turn.streaming" class="answer__rich" :nodes="renderAnswer(turn.text)" />
       <view v-else class="answer__stream"><text class="answer__text">{{ turn.text }}</text><text class="caret" /></view>
      </view>
      <ActionDraftCard v-if="turn.draft" :draft="turn.draft" :result="turn.result" :busy="busy" @select="selectDraft(turn, $event)" @confirm="confirmDraft(turn)" @cancel="cancelDraft(turn)" @revalidate="revalidateDraft(turn)" />
      <text v-if="turn.result && turn.result.summary && turn.result.summary.status === 'completed'" class="answer conclusion" selectable>{{ turn.result.summary.text }}</text>
      <view v-else-if="turn.result && turn.result.summary && turn.result.summary.status === 'running'" class="thinking"><view class="thinking__dot" /><text>正在整理执行结果</text></view>
      <button v-else-if="turn.result && turn.result.summary && turn.result.summary.status === 'failed'" class="trace-toggle" :disabled="busy" @click="retryAnswer(turn)">重试回答</button>
      <view v-if="turn.error" class="error-card">
       <view class="error-card__row">
        <view class="error-card__seal" aria-hidden="true" />
        <text class="error-card__text">{{ friendlyError(turn.error) }}</text>
       </view>
       <view class="error-card__actions">
        <button class="chip" :disabled="busy" @click="startEdit(turn)">编辑</button>
        <button class="chip chip--primary" :disabled="busy" @click="retryTurn(turn)">重试</button>
       </view>
      </view>
     </view>
    </view>
    <view v-if="errorMessage" class="page-error"><text>{{ friendlyError(errorMessage) }}</text><button class="trace-toggle" @click="restore">重新连接</button></view>
    <view id="agent-bottom" class="anchor" />
   </view>
  </scroll-view>
  <view class="composer-shell"><AgentComposer v-model="input" :running="isRunning" :disabled="!conversationId || mutating || hasExecution" @send="sendMessage" @stop="stopRun" /></view>
 </view>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { cancelAction, confirmAction, createConversation, restoreConversation, clearConversation, updateSelection, retrySummary, revalidateAction, streamMessage } from '@/apis/agent'
import { createTurn, applyEvent, restoreTurns, friendlyError } from './conversation.mjs'
import { renderAnswer } from './answer.mjs'
import ActionDraftCard from './components/ActionDraftCard.vue'
import AgentComposer from './components/AgentComposer.vue'
import ToolActivity from './components/ToolActivity.vue'
const conversationId = ref('')
const input = ref('')
const turns = ref([])
const errorMessage = ref('')
const isRunning = ref(false)
const mutating = ref(false)
const editingId = ref('')
const editDraft = ref('')
const scrollIntoView = ref('')
const nearBottom = ref(true)
const hasExecution = computed(() => turns.value.some(turn => turn.draft?.status === 'EXECUTING' || turn.result?.summary?.status === 'running'))
const busy = computed(() => isRunning.value || mutating.value || hasExecution.value)
const statusText = computed(() => !conversationId.value ? '正在连接' : busy.value ? '正在处理' : '服务在线')
let activeRequest, pollTimer, expiryTimer
let disposed = false, visible = true, restoring = false, sequence = 0
let deltaTimer = null
const bufferedDelta = { turn: null, content: '' }
function follow(force = false) {
 if (!force && !nearBottom.value) return
 scrollIntoView.value = ''
 nextTick(() => { if (!disposed) scrollIntoView.value = 'agent-bottom' })
}
function handleScroll(event) { if (event.detail.deltaY > 5) nearBottom.value = false }
function flushBufferedDelta() {
 if (bufferedDelta.turn && bufferedDelta.content) {
  applyEvent(bufferedDelta.turn, { type: 'message.delta', content: bufferedDelta.content })
  bufferedDelta.content = ''
 }
}
function schedule() {
 clearTimeout(pollTimer)
 if (visible && !disposed && (hasExecution.value || isRunning.value && !activeRequest)) pollTimer = setTimeout(restore, 1500)
 clearTimeout(expiryTimer)
 const pending = turns.value.filter(turn => turn.draft?.status === 'PENDING_CONFIRMATION')
 const deadline = Math.min(...pending.map(turn => Date.parse(turn.draft.expiresAt)))
 if (Number.isFinite(deadline)) expiryTimer = setTimeout(() => {
  for (const turn of pending) if (!mutating.value && turn.draft.status === 'PENDING_CONFIRMATION' && Date.parse(turn.draft.expiresAt) <= Date.now()) turn.draft.status = 'EXPIRED'
 }, Math.max(0, deadline - Date.now()))
}
function isLastTurn(index) { return index === turns.value.length - 1 }
async function restore() {
 if (restoring || activeRequest || disposed) return
 restoring = true
 try {
  const restored = await restoreConversation()
  const conversation = restored.conversation || await createConversation()
  if (disposed) return
  conversationId.value = conversation.id
  turns.value = restoreTurns(conversation.turns)
  isRunning.value = Boolean(conversation.running)
  if (!isRunning.value) turns.value.forEach(turn => { turn.running = false; turn.streaming = false })
  errorMessage.value = ''
  follow()
  schedule()
 } catch (error) { if (!disposed) { errorMessage.value = error.message; schedule() } }
 finally { restoring = false }
}
async function sendMessage(contentOverride) {
 const content = (typeof contentOverride === 'string' ? contentOverride : input.value).trim()
 if (!content || busy.value || !conversationId.value) return
 cancelEdit()
 turns.value.push(createTurn('local-' + Date.now() + '-' + sequence++, content))
 const current = turns.value[turns.value.length - 1]
 if (typeof contentOverride !== 'string') input.value = ''
 isRunning.value = true
 errorMessage.value = ''
 follow(true)
 const request = streamMessage(conversationId.value, content, event => {
  if (disposed) return
  if (event.type === 'message.delta') {
   // 逐 token 渲染会打爆 setData，按帧合并后再上屏。
   bufferedDelta.turn = current
   bufferedDelta.content += event.content || ''
   if (!deltaTimer) deltaTimer = setTimeout(() => { deltaTimer = null; flushBufferedDelta(); follow() }, 150)
   return
  }
  if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null }
  flushBufferedDelta()
  applyEvent(current, event)
  if (event.type === 'action.proposed') for (const previous of turns.value) if (previous !== current && previous.draft?.draftId === event.draftId) { previous.draft = null; previous.result = null }
  follow()
 })
 activeRequest = request
 try { await request.promise }
 catch (error) { if (!disposed && current.running) current.error = error.message }
 finally {
  if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null }
  flushBufferedDelta()
  current.running = false
  current.streaming = false
  isRunning.value = false
  activeRequest = null
  if (!disposed) schedule()
 }
}
function retryTurn(turn) {
 if (busy.value || turn.running) return
 const content = turn.content
 if (turn.error) {
  const index = turns.value.indexOf(turn)
  if (index > -1) turns.value.splice(index, 1)
 }
 sendMessage(content)
}
function startEdit(turn) {
 if (busy.value) return
 editingId.value = turn.id
 editDraft.value = turn.content
}
function cancelEdit() {
 editingId.value = ''
 editDraft.value = ''
}
function resendEdit() {
 const turn = turns.value.find(item => item.id === editingId.value)
 const content = editDraft.value.trim()
 if (!turn || !content || busy.value) return
 cancelEdit()
 if (turn.error) {
  const index = turns.value.indexOf(turn)
  if (index > -1) turns.value.splice(index, 1)
 }
 sendMessage(content)
}
async function selectDraft(turn, selected) {
 if (busy.value || turn.draft.status !== 'PENDING_CONFIRMATION') return
 const previous = turn.draft.selectedActionIds
 turn.draft.selectedActionIds = selected
 mutating.value = true
 try { Object.assign(turn.draft, await updateSelection(turn.draft.draftId, turn.draft.revision, selected)) }
 catch (error) { turn.draft.selectedActionIds = previous; errorMessage.value = error.message }
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
 turn.streaming = false
 for (const item of turn.activities) if (item.status === 'running') item.status = 'skipped'
 activeRequest.abort()
}
function clearHistory() {
 if (busy.value || !conversationId.value) return
 uni.showModal({ title: '清除会话', content: '清除当前对话和草案记录？', success: async response => {
  if (!response.confirm || busy.value) return
  mutating.value = true
  try { await clearConversation(conversationId.value); conversationId.value = ''; turns.value = []; cancelEdit(); await restore() }
  catch (error) { errorMessage.value = error.message }
  finally { mutating.value = false }
 } })
}
onLoad(restore)
onShow(() => { visible = true; if (conversationId.value && !activeRequest) restore() })
onHide(() => { visible = false; clearTimeout(pollTimer) })
onUnload(() => { disposed = true; clearTimeout(pollTimer); clearTimeout(expiryTimer); if (deltaTimer) clearTimeout(deltaTimer); activeRequest?.abort() })
</script>
<style scoped>
.agent-page { height:100vh; display:flex; flex-direction:column;
 background:
  radial-gradient(140% 90% at 50% -10%, #265c45 0%, #173b2c 46%, #0d2117 100%),
  repeating-linear-gradient(52deg, rgba(255,255,255,.014) 0 2rpx, transparent 2rpx 7rpx);
 color:#22332a; }
.agent-status { display:flex; align-items:center; gap:14rpx; padding:0 32rpx; min-height:76rpx;
 background:rgba(7,22,16,.72); border-bottom:1rpx solid rgba(255,255,255,.07); }
.agent-status__lamp { width:14rpx; height:14rpx; border-radius:50%;
 background:radial-gradient(circle at 34% 30%, #d9ffe8, #7fd6a4 55%, #2f8f6b);
 box-shadow:0 0 12rpx rgba(127,214,164,.55); }
.agent-status__lamp--busy { background:radial-gradient(circle at 34% 30%, #ffeccb, #e3b96a 55%, #a8792f); box-shadow:0 0 12rpx rgba(227,185,106,.55); }
.agent-status__text { flex:1; color:#cfe0d6; font-size:23rpx; letter-spacing:2rpx; }
.clear { width:80rpx; height:72rpx; line-height:72rpx; padding:0; margin:0; background:transparent; }.clear::after { border:0; }
.conversation { flex:1; height:0; min-height:0; }
.conversation__inner { padding:36rpx 28rpx 48rpx; }
.welcome { display:flex; justify-content:center; margin:96rpx 0; }
.welcome__plaque { min-width:60%; padding:52rpx 56rpx; border-radius:20rpx; text-align:center;
 background:linear-gradient(180deg, #fdfbf4 0%, #f1ebdc 100%);
 border:1rpx solid #d9cfb6; position:relative;
 box-shadow:inset 0 2rpx 0 rgba(255,255,255,.75), 0 24rpx 48rpx rgba(4,16,11,.4); }
.welcome__plaque::after { content:''; position:absolute; inset:10rpx; border:1rpx dashed rgba(23,107,84,.18); border-radius:14rpx; pointer-events:none; }
.welcome__title { display:block; font-size:38rpx; font-weight:700; color:#1d3a2c; text-shadow:0 1rpx 0 rgba(255,255,255,.8); letter-spacing:4rpx; }
.welcome__sub { display:block; margin-top:18rpx; font-size:25rpx; color:#75857a; }
.turn { margin-bottom:52rpx; }
.user-row { display:flex; justify-content:flex-end; align-items:flex-end; gap:14rpx; margin-bottom:26rpx; }
.user-tools { display:flex; gap:10rpx; padding-bottom:8rpx; }
.chip { min-width:0; padding:0 22rpx; margin:0; min-height:52rpx; line-height:52rpx; border-radius:999rpx;
 font-size:22rpx; color:#55685c;
 background:linear-gradient(180deg, #fbf8f0 0%, #e8e0cb 100%);
 border:1rpx solid #c6b998;
 box-shadow:inset 0 1rpx 0 rgba(255,255,255,.8), 0 3rpx 6rpx rgba(4,16,11,.25); }
.chip::after { border:0; }
.chip:active { box-shadow:inset 0 3rpx 6rpx rgba(74,60,28,.22); transform:translateY(1rpx); }
.chip[disabled] { color:#a9b3aa; }
.chip--primary { color:#f2f7f4; background:linear-gradient(180deg, #2f8f6b 0%, #1c6b50 60%, #175743 100%); border-color:#0f3f2d;
 box-shadow:inset 0 2rpx 2rpx rgba(255,255,255,.25), inset 0 -3rpx 5rpx rgba(0,0,0,.22), 0 6rpx 14rpx rgba(6,26,18,.4); }
.chip--primary[disabled] { color:#c4d2ca; background:linear-gradient(180deg,#9db8ab,#7d9a8c); border-color:#68816f; }
.user-message { max-width:78%; padding:20rpx 26rpx; border-radius:20rpx 6rpx 20rpx 20rpx;
 background:linear-gradient(178deg, #379a72 0%, #1f704f 48%, #185a40 100%);
 border:1rpx solid #0f3f2d; color:#eef7f1; font-size:28rpx; line-height:1.7;
 box-shadow:inset 0 2rpx 3rpx rgba(255,255,255,.26), inset 0 -4rpx 8rpx rgba(0,0,0,.22), 0 12rpx 24rpx rgba(4,20,14,.42); }
.user-edit { max-width:82%; padding:16rpx 18rpx 14rpx; border-radius:20rpx;
 background:linear-gradient(180deg, #fdfbf4, #f1ebdc); border:1rpx solid #c9bc9b;
 box-shadow:inset 0 2rpx 0 rgba(255,255,255,.75), 0 12rpx 24rpx rgba(4,20,14,.35); }
.user-edit__input { width:100%; min-height:60rpx; max-height:200rpx; padding:10rpx 12rpx; font-size:27rpx; line-height:1.6; color:#22332a;
 background:#f6f1e3; border:1rpx solid #d8ccab; border-radius:12rpx;
 box-shadow:inset 0 4rpx 10rpx rgba(84,68,32,.14); }
.user-edit__placeholder { color:#a9a08a; }
.user-edit__actions { display:flex; justify-content:flex-end; gap:12rpx; margin-top:12rpx; }
.agent-card { position:relative; padding:26rpx 26rpx 22rpx; border-radius:20rpx;
 background:linear-gradient(180deg, #fbf8f0 0%, #f3eee1 100%);
 border:1rpx solid #d9cfb6;
 box-shadow:inset 0 2rpx 0 rgba(255,255,255,.7), 0 22rpx 44rpx rgba(4,16,11,.38); }
.agent-card::after { content:''; position:absolute; inset:10rpx; border:1rpx dashed rgba(23,107,84,.15); border-radius:14rpx; pointer-events:none; }
.agent-heading { display:flex; align-items:center; gap:14rpx; margin-bottom:6rpx; }
.agent-avatar { width:52rpx; height:52rpx; border-radius:50%; display:flex; align-items:center; justify-content:center;
 background:radial-gradient(circle at 32% 28%, #ffefc2 0%, #d9ad63 55%, #a5793a 100%);
 border:2rpx solid #8a6428; box-shadow:inset 0 -3rpx 6rpx rgba(90,60,20,.4), 0 4rpx 8rpx rgba(4,16,11,.3); }
.agent-avatar text { color:#5d3f14; font-size:34rpx; font-weight:700; line-height:1; }
.agent-heading__name { font-size:27rpx; font-weight:700; color:#1e3a2d; letter-spacing:1rpx; }
.thinking { display:flex; align-items:center; gap:10rpx; margin:12rpx 0 4rpx; font-size:23rpx; color:#7d8f83; }
.thinking__dot { width:12rpx; height:12rpx; border-radius:50%;
 background:radial-gradient(circle at 34% 30%, #ffefc2, #d9ad63 60%, #a5793a);
 box-shadow:0 0 8rpx rgba(217,173,99,.6); animation:pulse 1.4s ease-in-out infinite; }
.trace-toggle { display:inline-flex; align-items:center; gap:12rpx; padding:0 8rpx; margin:8rpx 0; min-height:56rpx; line-height:56rpx; background:transparent; color:#5c6f64; font-size:24rpx; }.trace-toggle::after { border:0; }
.answer { display:block; margin-top:14rpx; }
.answer__rich, .answer__text { font-size:28rpx; line-height:1.8; color:#22332a; }
.answer__stream { display:block; }
.answer__text { display:inline; white-space:pre-wrap; overflow-wrap:break-word; }
.caret { display:inline-block; width:4rpx; height:32rpx; margin:0 0 4rpx 6rpx; vertical-align:-6rpx; background:#176b54; animation:caret-blink 1s steps(2, start) infinite; }
.conclusion { margin-top:24rpx; white-space:pre-wrap; overflow-wrap:break-word; }
.error-card { margin-top:18rpx; padding:18rpx 20rpx; border-radius:14rpx;
 background:linear-gradient(180deg, #f9f1dd 0%, #f1e3c2 100%);
 border:1rpx solid #dcc28c;
 box-shadow:inset 0 1rpx 0 rgba(255,255,255,.7), 0 8rpx 18rpx rgba(60,44,12,.18); }
.error-card__row { display:flex; align-items:flex-start; gap:14rpx; }
.error-card__seal { flex:0 0 18rpx; width:18rpx; height:18rpx; margin-top:8rpx; border-radius:50%;
 background:radial-gradient(circle at 34% 30%, #ffe1a6, #d29b3f 60%, #9c6c1d);
 box-shadow:inset 0 -2rpx 4rpx rgba(90,60,10,.4), 0 2rpx 4rpx rgba(90,60,10,.3); }
.error-card__text { flex:1; font-size:25rpx; line-height:1.6; color:#7a5a17; }
.error-card__actions { display:flex; justify-content:flex-end; gap:12rpx; margin-top:14rpx; }
.page-error { display:flex; align-items:center; gap:16rpx; margin-top:16rpx; color:#e8c982; font-size:24rpx; }
.page-error .trace-toggle { color:#cfe0d6; }
.composer-shell { padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
 background:rgba(7,22,16,.6); border-top:1rpx solid rgba(255,255,255,.07); }
.anchor { height:2rpx; }
@keyframes caret-blink { 0%, 49% { opacity:1; } 50%, 100% { opacity:0; } }
@keyframes pulse { 0%, 100% { transform:scale(1); opacity:1; } 50% { transform:scale(.72); opacity:.55; } }
@media (prefers-reduced-motion: reduce) { .caret, .thinking__dot { animation:none; } }
</style>
