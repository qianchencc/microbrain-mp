import { computed, ref } from 'vue'
import { listRegions, markRegionSeen } from '@/apis/agent/observations'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'

export const regions = ref([])
export const focusRegionId = ref('')
export const regionsLoading = ref(false)
export const regionsError = ref('')
export const focusRegion = computed(() => regions.value.find(region => region.id === focusRegionId.value) || null)
let owner = ''
let sequence = 0
let loadedAt = 0, inFlight = null
const storageKey = scope => 'agent-focus-region:' + scope

export async function loadRegionFocus() {
 await waitForAgentSession()
 const scope = getAgentStorageScope()
 if (scope === owner && regions.value.length && Date.now() - loadedAt < 30000) return
 if (inFlight?.scope === scope) return inFlight.promise
 const request = ++sequence
 if (scope !== owner) { regions.value = []; focusRegionId.value = ''; owner = scope; loadedAt = 0 }
 regionsLoading.value = true
 regionsError.value = ''
 const promise = (async () => {
  try {
   const result = await listRegions('directory')
   if (request !== sequence || scope !== getAgentStorageScope()) return
   regions.value = result.regions || []
   const saved = uni.getStorageSync(storageKey(scope))
   focusRegionId.value = regions.value.find(region => region.id === saved)?.id || regions.value[0]?.id || ''
   uni.setStorageSync(storageKey(scope), focusRegionId.value)
   loadedAt = Date.now()
   // Names are already usable; device-level attention must not gate selection.
   listRegions().then(latest => {
    if (request !== sequence || scope !== getAgentStorageScope()) return
    const attention = new Map((latest.regions || []).map(region => [region.id, region.attention]))
    regions.value = regions.value.map(region => ({ ...region, attention: attention.get(region.id) }))
   }).catch(() => {})
  } catch (error) {
   if (request === sequence) { regions.value = []; focusRegionId.value = ''; regionsError.value = error.message || '区域暂不可用' }
   throw error
  } finally {
   if (request === sequence) regionsLoading.value = false
   if (inFlight?.promise === promise) inFlight = null
  }
 })()
 inFlight = { scope, promise }
 return promise
}

export function selectFocusRegion(id) {
 if (regionsLoading.value || owner !== getAgentStorageScope() || !regions.value.some(region => region.id === id)) return false
 focusRegionId.value = id
 uni.setStorageSync(storageKey(owner), id)
 return true
}

export async function acknowledgeRegion(id) {
 const scope = getAgentStorageScope()
 if (!id || scope !== owner || !regions.value.some(region => region.id === id)) return
 await markRegionSeen(id)
 if (scope === getAgentStorageScope()) regions.value = regions.value.map(region =>
  region.id === id ? { ...region, attention: false } : region)
}

const composeKey = scope => 'agent-compose-prefill:' + scope

// 工作台“新建任务”回到对话时的一次性输入预填：写入当前身份作用域，Agent 页 onShow 消费一次即清除。
export function queueComposePrefill(text) {
 const scope = getAgentStorageScope()
 if (!scope || !text) return
 uni.setStorageSync(composeKey(scope), text)
}

export function consumeComposePrefill() {
 const scope = getAgentStorageScope()
 if (!scope) return ''
 const text = uni.getStorageSync(composeKey(scope))
 if (text) uni.removeStorageSync(composeKey(scope))
 return typeof text === 'string' ? text : ''
}
