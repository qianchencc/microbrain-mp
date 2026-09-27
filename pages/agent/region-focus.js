import { computed, ref } from 'vue'
import { listRegions } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'

export const regions = ref([])
export const focusRegionId = ref('')
export const regionsLoading = ref(false)
export const regionsError = ref('')
export const focusRegion = computed(() => regions.value.find(region => region.id === focusRegionId.value) || null)
let owner = ''
let sequence = 0
const storageKey = scope => 'agent-focus-region:' + scope

export async function loadRegionFocus() {
 const request = ++sequence
 regionsLoading.value = true
 regionsError.value = ''
 try {
  await waitForAgentSession()
  const scope = getAgentStorageScope()
  if (scope !== owner) { regions.value = []; focusRegionId.value = ''; owner = scope }
  const result = await listRegions()
  if (request !== sequence || scope !== getAgentStorageScope()) return
  regions.value = result.regions || []
  const saved = uni.getStorageSync(storageKey(scope))
  focusRegionId.value = regions.value.find(region => region.id === saved)?.id || regions.value[0]?.id || ''
  uni.setStorageSync(storageKey(scope), focusRegionId.value)
 } catch (error) {
  if (request === sequence) { regions.value = []; focusRegionId.value = ''; regionsError.value = error.message || '区域暂不可用' }
  throw error
 } finally { if (request === sequence) regionsLoading.value = false }
}

export function selectFocusRegion(id) {
 if (regionsLoading.value || owner !== getAgentStorageScope() || !regions.value.some(region => region.id === id)) return false
 focusRegionId.value = id
 uni.setStorageSync(storageKey(owner), id)
 return true
}
