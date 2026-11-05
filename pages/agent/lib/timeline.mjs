// Timeline projection entrypoint. Geometry and SVG rendering stay behind one page-domain seam.
export {
  HOUR_PX,
  createTimeline,
  dateFocusTop,
  firstDayCard,
  localDate,
  timelineYOf,
} from '../domains/regions/timeline-geometry.mjs';
export { timelineSvg } from '../domains/regions/timeline-svg.mjs';
