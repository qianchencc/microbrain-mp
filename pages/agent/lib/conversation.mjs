// Conversation domain entrypoint. Consumers use this seam instead of implementation files.
export {
  createTurn,
  applyEvent,
  restoreTurns,
  canRecoverTurn,
  restartTurn,
  mergeTaskDetail,
  friendlyError,
  operationText,
  receiptText,
} from '../domains/conversation/conversation.mjs'
export { createPresentation } from '../domains/conversation/presentation.mjs'
export {
  preserveComposerDraft,
  takeComposerDraft,
  preserveComposerReference,
  takeComposerReference,
  preserveComposerView,
  takeComposerView,
} from '../domains/conversation/composer-drafts.mjs'
export { parseAgentContext, meterHistoryPrompt } from '../domains/conversation/context-link.mjs'
export { createConversationRecovery } from '../domains/conversation/conversation-recovery.mjs'
export { beginAgentEntry, markAgentEntry, getAgentEntryTimings } from '../domains/conversation/entry-timing.mjs'
export { createContextDelivery } from '../domains/conversation/context-delivery.mjs'
