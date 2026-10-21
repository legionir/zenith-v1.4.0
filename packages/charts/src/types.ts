// packages/charts/src/types.ts
//
// Chart shapes, frozen defaults and the options schema. The schema carries a
// small runtime (defineOptions) but no DOM/SVG code, so validators and
// type-only consumers never pull the renderers into their graph.
import { s, defineOptions, type Schema } from '@zenith/schema';
import type { ReadonlySignal } from '@zenith/state';
import type { Disposable } from '@zenith/shared';

export type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'scatter';

export type ChartRow = Record<string, string | number | Date | null | undefined>;

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export interface ChartOptions {
  type: ChartType;
  data: ChartRow[] | ReadonlySignal<ChartRow[]>;
  x: string;
  y: string | string[];
  series?: ChartSeries[];
  width?: number;
  height?: number;
  legend?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  locale?: string;
  a11yTable?: boolean;
  title?: string;
  colors?: string[];
}

export interface Chart extends Disposable {
  update(data: ChartRow[]): void;
  resize(): void;
  toImage(): string;
  dispose(): void;
}

/**
 * #53 / #169: پیش‌فرض‌های منجمد charts.
 * @default { height: 300, legend: true, tooltip: true, animate: true, a11yTable: true, locale: 'en-US' }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  height: 300,
  width: 480,
  legend: true,
  tooltip: true,
  animate: true,
  a11yTable: true,
  locale: 'en-US' as string,
});

export const chartOptionsSchema = defineOptions<ChartOptions>(
  'ChartOptions',
  s.object({
    type: s.enum(['line', 'area', 'bar', 'pie', 'scatter'] as const),
    x: s.string(),
    y: s.union([s.string(), s.array(s.string())]) as unknown as Schema<string | string[]>,
    height: s.default(s.number(), DEFAULTS.height),
    legend: s.default(s.boolean(), DEFAULTS.legend),
    tooltip: s.default(s.boolean(), DEFAULTS.tooltip),
    animate: s.default(s.boolean(), DEFAULTS.animate),
    a11yTable: s.default(s.boolean(), DEFAULTS.a11yTable),
    locale: s.default(s.string(), DEFAULTS.locale),
  }) as unknown as Schema<ChartOptions>,
);

/** Shared categorical palette for series and pie slices. */
export const PALETTE = /* @__PURE__ */ Object.freeze([
  '#4f7cff',
  '#34a853',
  '#f9a825',
  '#d93025',
  '#9c27b0',
  '#00bcd4',
  '#ff7043',
  '#607d8b',
]);
