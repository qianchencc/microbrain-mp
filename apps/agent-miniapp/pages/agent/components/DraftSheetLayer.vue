<template>
 <DeviceSheet :open="open" :open-request="openRequest" :title="sheetTitle" :meta="sheetMeta" :subtitle="sheetSubtitle" :tall="browser" :busy="busy" @close="emit('close')">
  <template v-if="browser && page !== 2" #header-right>
   <view class="header-actions">
    <button v-if="dirty" class="title-restore" :disabled="busy" hover-class="title-restore--pressed" @tap="emit('restore')">还原</button>
    <button class="title-select-all" :disabled="busy || !pending" hover-class="title-select-all--pressed" @tap="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
   </view>
  </template>
  <view v-if="browser" class="pages" :class="{ editing: page === 2 }">
   <view class="surface devices-surface">
    <view class="header-viewport" :class="{ searching: page === 1 }">
     <view class="controls">
      <view class="chip-flow">
       <button v-for="(mode, index) in groupModes" :key="mode.by" class="chip" :class="{ active: index === groupIndex }" hover-class="chip--pressed" @tap="selectGroup(index)"><text>{{ mode.label }}</text></button>
       <button class="search-toggle" aria-label="搜索设备" hover-class="search-toggle--pressed" :hover-stay-time="60" @tap="openSearch"><image class="search-toggle-icon" src="/static/search.svg" /></button>
      </view>
     </view>
     <view v-if="searchMounted" class="search-controls">
      <button class="search-back" aria-label="返回全部设备" hover-class="search-back--pressed" :hover-stay-time="60" @tap="closeSearch"><image class="back-icon" src="/static/back.svg" /></button>
      <view class="search-field"><image class="search-field-icon" src="/static/search.svg" /><input v-model="search" class="search-input" placeholder="搜索设备名称或位置" placeholder-style="color:#8a978f" confirm-type="search" :focus="searchFocused" :adjust-position="false" /></view>
     </view>
    </view>
    <view class="device-scroll-shell"><scroll-view scroll-y class="device-list"><view v-for="group in groups" :key="group.key" class="group" :style="{ width: grid.trackWidth + 'px' }"><text class="group-title">{{ group.label }} · {{ group.items.length }}</text><view class="grid"><DeviceActionCard v-for="item in group.items" :key="item.action.id" :action="item.action" :index="item.index" :selected="selected.includes(item.action.id)" :readonly="!pending" :disabled="busy" :phase="phase(item.action)" :current-state="states[item.action.deviceId] ?? null" :operation="operationLabel(item.action)" :outcome-label="outcome(item.action)" :highlight="search" @toggle="toggle(item.action.id)" @configure="configure(item.action)" /></view></view><text v-if="!groups.length" class="note">没有匹配的设备</text><view class="list-tail" /></scroll-view></view>
    <view class="confirm-float"><button class="confirm-btn" :disabled="busy || !pending || !selected.length" hover-class="confirm-btn--pressed" @tap="emit('close'); emit('confirm')"><text class="confirm-btn-text">确认草案 · {{ selected.length }}</text></button><text class="confirm-caption">已选择 {{ selected.length }} 台设备</text></view>
   </view>
   <view class="surface editor-surface">
    <button v-if="current" class="back" hover-class="back--pressed" @tap="page = editorBack"><image class="back-icon" src="/static/back.svg" /><text>{{ current.deviceName }}</text></button>
    <view v-if="current && !pending" class="stale-note"><text>{{ staleText }}</text><button v-if="draft.status === 'EXPIRED'" class="stale-revalidate" :disabled="busy" hover-class="stale-revalidate--pressed" @tap="emit('revalidate')">重新核验</button></view>
    <ParameterEditor v-if="current && pending" embedded :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
   </view>
  </view>
  <ParameterEditor v-else-if="current" :key="current.id" :action="current" :actions="draft.actions" :states="states" :busy="busy" :error="parameterError" @save="save" />
 </DeviceSheet>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { readDeviceStates, updateParameters } from '@/apis/agent'
import { operationLabel } from '../ac-draft.js'
import { receiptPhase } from '../device-card-state.js'
import { computeDeviceGrid, createDraftGroups, draftBaselineChanged } from '../action-draft-presentation.js'
import { receiptText } from '../conversation.mjs'
import DeviceActionCard from './DeviceActionCard.vue'
import DeviceSheet from './DeviceSheet.vue'
import ParameterEditor from './ParameterEditor.vue'
const props = defineProps({ draft: { type: Object, default: null }, result: { type: Object, default: null }, baseline: { type: Object, default: null }, browser: Boolean, currentActionId: { type: String, default: '' }, openRequest: { type: Number, default: 0 }, busy: Boolean })
const emit = defineEmits(['close', 'select', 'confirm', 'updated', 'editing', 'revalidate', 'restore'])
const initialWindowWidth = uni.getWindowInfo?.().windowWidth || uni.getSystemInfoSync().windowWidth || 320
const states = ref({}), page = ref(0), search = ref(''), searchMounted = ref(false), searchFocused = ref(false), groupIndex = ref(0), parameterError = ref(''), windowWidth = ref(initialWindowWidth)
const currentId = ref(''), editorBack = ref(0)
let focusTimer, searchTimer
const groupModes = [{ label: '区域', by: 'location' }, { label: '类型', by: 'kind' }, { label: '选择', by: 'selection' }]
const grid = computed(() => computeDeviceGrid(windowWidth.value))
function selectGroup(index) { groupIndex.value = index }
const open = computed(() => Boolean(props.draft))
const pending = computed(() => props.draft?.status === 'PENDING_CONFIRMATION')
const staleText = computed(() => ({ EXPIRED: '核验已过期，未执行。重新核验后可继续调整。', CANCELLED: '操作已取消，未执行。发送新指令可重新下达。' }[props.draft?.status] || ''))
const selected = computed(() => props.draft?.selectedActionIds || [])
const allSelected = computed(() => Boolean(props.draft?.actions.length) && selected.value.length === props.draft.actions.length)
// 「还原」仅在有改动时出现：草案与发布基线一致时它是纯噪声；过期/终态只读不显示。
const dirty = computed(() => pending.value && draftBaselineChanged(props.draft, props.baseline))
const current = computed(() => props.draft?.actions.find(action => action.id === currentId.value) ?? null)
const browserEditor = computed(() => props.browser && page.value === 2)
const sheetTitle = computed(() => browserEditor.value ? current.value?.kind === 'ac' ? '空调调节' : '开门设置' : props.browser ? '全部设备' : current.value?.kind === 'ac' ? '空调调节' : '开门设置')
const sheetMeta = computed(() => props.browser && !browserEditor.value ? `${props.draft?.actions.length || 0} 台设备` : '')
const sheetSubtitle = computed(() => browserEditor.value || !props.browser ? current.value?.deviceName || '' : '')
const kindSearchNames = { lighting: '照明 灯 灯具', ac: '空调 中央空调', access: '门禁 电动门 门' }
const filteredActions = computed(() => {
 if (!props.draft) return []
 const query = search.value.trim().toLocaleLowerCase()
 if (!query) return props.draft.actions
 return props.draft.actions.filter(action => [action.deviceName, action.location, kindSearchNames[action.kind], action.kind].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
})
const groups = computed(() => createDraftGroups(filteredActions.value, selected.value, { groupBy: groupModes[groupIndex.value].by }))
watch(() => props.currentActionId, value => { currentId.value = value }, { immediate: true })
watch(() => props.draft?.draftId, () => { page.value = 0; search.value = ''; searchMounted.value = false; searchFocused.value = false; groupIndex.value = 0; parameterError.value = '' })
// 面板内三页导航：0 全部设备 / 1 搜索 / 2 参数编辑；返回列表页即清过滤，列表始终是全量。
watch(page, value => { if (value === 0) search.value = '' })
watch(open, value => { if (value) refresh() })
function updateWindowWidth(event) { windowWidth.value = event?.size?.windowWidth || event?.windowWidth || uni.getWindowInfo?.().windowWidth || windowWidth.value }
onMounted(() => uni.onWindowResize?.(updateWindowWidth))
onBeforeUnmount(() => { clearTimeout(focusTimer); clearTimeout(searchTimer); uni.offWindowResize?.(updateWindowWidth) })
function toggle(id) { if (!pending.value || props.busy) return; emit('select', selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id]) }
function toggleAll() { if (!pending.value || props.busy) return; emit('select', allSelected.value ? [] : props.draft.actions.map(action => action.id)) }
function openSearch() {
 clearTimeout(focusTimer); clearTimeout(searchTimer)
 searchMounted.value = true
 searchTimer = setTimeout(() => { page.value = 1; focusTimer = setTimeout(() => { searchFocused.value = true }, 220) }, 20)
}
function closeSearch() {
 clearTimeout(focusTimer); clearTimeout(searchTimer)
 searchFocused.value = false
 page.value = 0
 searchTimer = setTimeout(() => { searchMounted.value = false }, 280)
}
function configure(action) { if (props.busy || !pending.value) return; currentId.value = action.id; parameterError.value = ''; if (props.browser) { editorBack.value = page.value; page.value = 2 } }
function receipt(action) { return props.result?.receipts?.find(item => item.actionId === action.id) }
function outcome(action) { return receiptText(receipt(action)) }
function phase(action) {
 if (props.result) return receiptPhase(action, receipt(action)?.outcome ?? (selected.value.includes(action.id) ? props.result.status : 'UNSELECTED'), states.value[action.deviceId])
 return props.draft.status === 'CANCELLED' ? 'cancelled' : props.draft.status === 'EXPIRED' ? 'expired' : 'pending'
}
async function refresh() {
 if (!props.draft) return
 try { const snapshot = await readDeviceStates(props.draft.draftId); states.value = snapshot.states }
 catch { states.value = {} }
}
async function save(changes) {
 if (props.busy || !pending.value) return
 emit('editing', true)
 parameterError.value = ''
 try {
  const updated = await updateParameters(props.draft.draftId, props.draft.revision, changes)
  emit('updated', updated)
  if (props.browser) page.value = 0
  else emit('close')
 }
 catch (error) { parameterError.value = error.message }
 finally { emit('editing', false) }
}
</script>
<style scoped>
.pages { flex:1; min-height:0; height:0; }.editor-page { display:flex; flex-direction:column; height:100%; overflow:hidden; }.search-page { display:flex; flex-direction:column; height:100%; overflow:hidden; }.search-scroll-shell { flex:1; min-height:0; overflow:hidden; }.browser { position:relative; isolation:isolate; display:flex; flex-direction:column; height:100%; }.device-scroll-shell { position:relative; z-index:0; flex:1; min-height:0; overflow:hidden; }.stale-note { display:flex; align-items:center; gap:8px; margin:12px 20px 0; padding:9px 12px; border-radius:8px; background:#fbf3e2; color:#7a5a16; font-size:12px; line-height:1.5; flex-shrink:0; }.stale-note text { flex:1; min-width:0; }.stale-revalidate { min-height:32px; margin:0; padding:0 12px; border-radius:7px; background:#176b54; color:white; font-size:12px; line-height:30px; white-space:nowrap; flex-shrink:0; }.stale-revalidate--pressed { transform:scale(.97); opacity:.85; }.stale-revalidate[disabled] { opacity:.4; }.stale-revalidate::after { border:0; }.controls { position:relative; z-index:3; padding:0 20px; flex-shrink:0; }.chip-flow { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px 0 10px; }.chip { display:flex; align-items:center; gap:5px; height:32px; margin:0; padding:0 14px; border:1px solid transparent; border-radius:16px; background:#eff2ee; color:#45564d; font-size:12px; line-height:30px; transition:transform 130ms cubic-bezier(.23,1,.32,1),opacity 150ms ease; }.chip--pressed { transform:scale(.95); opacity:.8; }.chip.active { background:#176b54; border-color:#176b54; color:#fff; }.search-toggle { width:32px; height:32px; margin:0; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid #d8e1dc; background:#f4f7f5; border-radius:16px; flex-shrink:0; transition:transform 120ms ease-out,background 160ms ease; }.search-toggle--pressed { transform:scale(.94); background:#e8efeb; }.search-toggle-icon { display:block; width:14px; height:14px; }.search-row { display:flex; align-items:center; gap:8px; height:42px; margin:8px 20px 10px; padding:0 14px; border:1px solid #d8e1dc; background:#f7faf8; border-radius:12px; flex-shrink:0; }.search-field-icon { display:block; width:15px; height:15px; flex-shrink:0; }.search-input { flex:1; height:100%; font-size:13px; color:#24382d; }.device-list { height:100%; box-sizing:border-box; padding:0 20px; }.device-list::-webkit-scrollbar { display:none; }.list-tail { height:94px; }.group { margin-bottom:20px; }.group-title { display:block; font-size:12px; font-weight:500; color:#5d6963; margin-bottom:12px; }.grid { display:flex; flex-wrap:wrap; gap:12px; width:100%; max-width:412px; margin:0 auto; }.grid device-action-card { width:calc(50% - 6px); }.confirm-float { position:absolute; z-index:20; left:0; right:0; bottom:0; display:flex; flex-direction:column; align-items:center; gap:4px; padding:22px 20px calc(10px + env(safe-area-inset-bottom)); pointer-events:none; background:linear-gradient(to bottom, rgba(252,253,252,0), #fcfdfc 55%); }.confirm-btn { pointer-events:auto; display:flex; align-items:center; justify-content:center; width:68%; min-width:216px; max-width:320px; height:42px; box-sizing:border-box; margin:0; padding:0 24px; border:1px solid #294d3b; border-radius:21px; background:linear-gradient(180deg,#fffef9 0%,#faf7ee 64%,#f2ead7 100%); box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(155,120,56,.12),0 1px 2px rgba(25,52,39,.14),0 7px 18px rgba(25,52,39,.16); transition:transform 130ms cubic-bezier(.23,1,.32,1),box-shadow 160ms ease,background-color 160ms ease; }.confirm-btn-text { color:#294d3b; font-size:14px; font-weight:600; letter-spacing:.2px; }.confirm-btn--pressed { transform:scale(.975); background:linear-gradient(180deg,#faf8ef,#f1e8d5); box-shadow:inset 0 1px 3px rgba(45,58,48,.12),0 1px 2px rgba(25,52,39,.14),0 5px 12px rgba(25,52,39,.14); }.confirm-btn[disabled] { opacity:1; border-color:#9aa99f; background:linear-gradient(180deg,#fbfaf5 0%,#f7f3e9 62%,#eee7d8 100%); box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(155,120,56,.10),0 2px 3px rgba(25,52,39,.10),0 8px 18px rgba(25,52,39,.13); }.confirm-btn[disabled] .confirm-btn-text { color:#87968d; }.confirm-caption { color:#8a968e; font-size:10px; line-height:15px; }.title-select-all { height:32px; margin:0; padding:0 14px; border-radius:16px; background:#eef1ec; color:#41544a; font-size:12px; line-height:30px; white-space:nowrap; flex-shrink:0; }.title-select-all--pressed { opacity:.7; transform:scale(.96); }.title-select-all[disabled] { opacity:.4; }.back { display:flex; align-items:center; gap:6px; margin:0; padding:0 20px; font-size:12px; line-height:40px; background:transparent; color:#728178; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.back--pressed { transform:scale(.97); opacity:.7; }.back-icon { display:block; width:14px; height:14px; }.note { display:block; font-size:13px; color:#5d6963; margin:12px 20px; }button::after { border:0; }@media(prefers-reduced-motion:reduce){.search-toggle,.chip,.confirm-btn,.title-select-all{transition:none;}}
/* 微信 scroll-view 需要确定的非零祖先高度；覆盖旧的 height:0 兼容写法。 */
.pages { height:auto; overflow:hidden; }
.header-viewport { position:relative; overflow:visible; }
.header-viewport .controls { transition:transform 260ms cubic-bezier(.32,.72,0,1),opacity 170ms ease-out; }
.header-viewport.searching .controls { transform:translateX(-22px); opacity:0; pointer-events:none; }
.search-controls { position:absolute; inset:0; display:flex; align-items:center; gap:8px; padding:0 20px; box-sizing:border-box; opacity:0; transform:translateX(22px); pointer-events:none; transition:transform 260ms cubic-bezier(.32,.72,0,1),opacity 170ms ease-out; }
.header-viewport.searching .search-controls { opacity:1; transform:translateX(0); pointer-events:auto; }
.search-back { width:36px; height:36px; margin:0; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid #d8e1dc; border-radius:18px; background:#f4f7f5; opacity:0; transform:scale(.9); transition:transform 180ms cubic-bezier(.23,1,.32,1) 70ms,opacity 150ms ease-out 70ms; }
.header-viewport.searching .search-back { opacity:1; transform:scale(1); }
.search-back--pressed { transform:scale(.94)!important; }
.search-field { flex:1; min-width:0; height:36px; display:flex; align-items:center; gap:8px; padding:0 13px; box-sizing:border-box; border:1px solid #d8e1dc; border-radius:18px; background:#f4f7f5; opacity:0; transform:scaleX(.16); transform-origin:right center; transition:transform 260ms cubic-bezier(.32,.72,0,1),opacity 120ms ease-out; }
.header-viewport.searching .search-field { opacity:1; transform:scaleX(1); }
.pages { position:relative; isolation:isolate; flex:1; min-height:0; height:auto; overflow:hidden; background:#fcfdfc; }
.surface { position:absolute; inset:0; display:flex; flex-direction:column; min-height:0; transition:transform 240ms cubic-bezier(.32,.72,0,1),opacity 160ms ease-out; }
.devices-surface { z-index:0; transform:translateX(0); opacity:1; background:#fcfdfc; }
.editor-surface { z-index:1; transform:translateX(100%); opacity:1; overflow:hidden; pointer-events:none; background:#fcfdfc; }
.pages.editing .devices-surface { transform:translateX(-18%); opacity:.72; pointer-events:none; }
.pages.editing .editor-surface { transform:translateX(0); pointer-events:auto; }
.header-viewport { position:relative; z-index:3; flex-shrink:0; overflow:visible; border-bottom:1px solid #e3e8e4; }
.group { width:250px; margin-left:auto; margin-right:auto; }
.grid { display:flex; flex-wrap:wrap; gap:12px; width:100%; max-width:none; margin:0; }
.grid device-action-card { width:119px; }
.editor-surface .back { flex-shrink:0; }
.header-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.title-restore { height:32px; margin:0; padding:0 12px; border:1px solid #d3dcd6; border-radius:16px; background:transparent; color:#5d6f65; font-size:12px; line-height:30px; white-space:nowrap; flex-shrink:0; transition:transform 130ms cubic-bezier(.23,1,.32,1),opacity 150ms ease; }
.title-restore--pressed { transform:scale(.96); opacity:.75; }
.title-restore[disabled] { opacity:.4; }
@media(prefers-reduced-motion:reduce){.header-viewport,.header-viewport .controls,.search-controls,.search-back,.search-field,.surface,.title-restore{transition:none;}.pages.editing .devices-surface{transform:translateX(0);opacity:0}.editor-surface{transform:translateX(0);opacity:0}.pages.editing .editor-surface{opacity:1}}
</style>
