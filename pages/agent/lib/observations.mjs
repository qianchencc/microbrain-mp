// Observation domain entrypoint. It exposes facts and observation projections, not request plumbing.
export {
  fmtDateTime,
  fmtShanghaiDateTime,
  ageHint,
  videoOnline,
  videoStateText,
  videoViewLabel,
  environmentCells,
  environmentSource,
  energyPowerText,
  energyCurrentCells,
  energyStale,
  safetySubtypeOfName,
  safetySubtypeText,
  acDispositionText,
  acReadbackText,
  acStateText,
  acDotOf,
  acInspectionMeta,
} from '../observation-view.mjs'
export { safetyEventReference, referenceTitle } from '../safety-event.mjs'
export { defaultPlaybackDates, playbackWindowDates, playbackDates } from '../video-playback-window.mjs'
export { environmentHistoryPrompt, environmentWindowReference } from '../environment-reference.mjs'
