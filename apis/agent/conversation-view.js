import globalConfig from '@/config'
import { getAgentStorageScope } from '@/utils/agent-session'
import { createConversationRecovery } from '../../pages/agent/lib/conversation.mjs'

export const conversationRecovery = createConversationRecovery({
 getScope: getAgentStorageScope,
 getBackend: () => globalConfig.agentUrl,
 storage: {
  getStorageSync: key => uni.getStorageSync(key),
  setStorageSync: (key, value) => uni.setStorageSync(key, value),
  removeStorageSync: key => uni.removeStorageSync(key),
 },
})
