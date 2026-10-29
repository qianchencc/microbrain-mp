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
} from '../conversation.mjs'
export { createPresentation } from '../presentation.mjs'
export {
  preserveComposerDraft,
  takeComposerDraft,
  preserveComposerReference,
  takeComposerReference,
  preserveComposerView,
  takeComposerView,
} from '../composer-drafts.mjs'
export { parseAgentContext, meterHistoryPrompt } from '../context-link.mjs'
