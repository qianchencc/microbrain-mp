// Observation domain entrypoint. It exposes facts and observation projections, not request plumbing.
export {
  fmtDateTime,
  fmtShanghaiDateTime,
  stateObservationLabel,
  ageHint,
  videoOnline,
  videoStateText,
  videoViewLabel,
  environmentCells,
  pm25Zone,
  pm25ZoneTone,
  humidityZone,
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
} from '../domains/observations/observation-view.mjs';
export { safetyEventReference, referenceTitle } from '../domains/observations/safety-event.mjs';
export {
  defaultPlaybackDates,
  playbackWindowDates,
  playbackDates,
} from '../domains/observations/video-playback-window.mjs';
export {
  environmentHistoryPrompt,
  environmentWindowReference,
} from '../domains/observations/environment-reference.mjs';
export {
  environmentSampleIdentity,
  environmentTrendPoints,
  mergeEnvironmentHistory,
  environmentHistoryNotice,
  environmentWindowLabel,
  environmentTrendTicks,
} from '../domains/observations/environment-history.mjs';
