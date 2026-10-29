// Action domain entrypoint. Device commands and their receipt projections cross this seam.
export {
  acSummary,
  acTemperatureStep,
  commonSetting,
  editSettings,
  effectiveSettings,
  fanLabels,
  fieldLabels,
  modeLabels,
  operationLabel,
  settingStatus,
} from '../domains/actions/ac-draft.js'
export {
  computeDeviceGrid,
  createDraftBaseline,
  createDraftGroups,
  draftBaselineChanged,
  firstRowBelowFold,
  remainingBelowFold,
} from '../domains/actions/action-draft-presentation.js'
export { cardConfigurable, receiptPhase, reduceCardHold, stateText, tapBlockHint } from '../domains/actions/device-card-state.js'
export { rosterGroups, rosterLiveStats, rosterLiveView } from '../domains/actions/device-roster.js'
export { createStateRefresh } from '../domains/actions/state-refresh.mjs'
export { createViewportMeasurer } from '../domains/actions/list-viewport.mjs'
