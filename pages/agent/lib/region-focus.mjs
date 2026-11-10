// Region focus entrypoint. The focus adapter depends on Vue/session state and is kept separate from pure region projections.
export {
  regions,
  focusRegionId,
  regionsLoading,
  regionsError,
  focusRegion,
  loadRegionFocus,
  selectFocusRegion,
  acknowledgeRegion,
} from '../domains/regions/region-focus.js';
