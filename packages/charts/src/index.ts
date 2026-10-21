// packages/charts/src/index.ts — @zenith/charts (#169) L2 barrel.
/** @public */
export {
  createChart,
  renderChartSvg,
  prefersReducedMotion,
} from './charts';

/** @public */
export {
  chartOptionsSchema,
  DEFAULTS,
  type Chart,
  type ChartOptions,
  type ChartRow,
  type ChartSeries,
  type ChartType,
} from './types';

/** @public */
export { processChart } from './directives';
