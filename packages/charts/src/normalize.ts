// packages/charts/src/normalize.ts
//
// Data normalization: raw rows + options ⇒ scaled plot model. Pure (no DOM),
// shared by the SVG builders and the reactive factory.
import {
  DEFAULTS,
  PALETTE,
  type ChartOptions,
  type ChartRow,
  type ChartSeries,
} from './types';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#x22;');
}

export function toNum(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface NormalizedSeries {
  label: string;
  color: string;
  points: { x: number; y: number; xLabel: string }[];
}

export interface Normalized {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  plotWidth: number;
  plotHeight: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  series: NormalizedSeries[];
  rows: ChartRow[];
  xKey: string;
  yKeys: string[];
  opts: Required<Pick<ChartOptions, 'legend' | 'tooltip' | 'a11yTable' | 'locale' | 'type'>> &
    Pick<ChartOptions, 'x' | 'y'> & { animate: boolean; title: string };
}

export function sx(n: Normalized, x: number): number {
  const span = n.maxX - n.minX;
  if (span === 0) return n.padding.left + n.plotWidth / 2;
  return n.padding.left + ((x - n.minX) / span) * n.plotWidth;
}

export function sy(n: Normalized, y: number): number {
  const span = n.maxY - n.minY;
  if (span === 0) return n.padding.top + n.plotHeight / 2;
  return n.padding.top + n.plotHeight - ((y - n.minY) / span) * n.plotHeight;
}

export function buildNormalized(options: ChartOptions, data: ChartRow[]): Normalized {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const xKey = options.x;
  const yKeys = Array.isArray(options.y) ? options.y : [options.y];
  const seriesDefs: ChartSeries[] =
    options.series ?? yKeys.map((key, i) => ({ key, label: key, color: options.colors?.[i] }));

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = 0;
  let maxY = Number.NEGATIVE_INFINITY;

  const series: NormalizedSeries[] = seriesDefs.map((def, i) => {
    const color = def.color ?? options.colors?.[i] ?? PALETTE[i % PALETTE.length]!;
    const points = data.map((row, idx) => {
      const x = toNum(row[xKey] ?? idx);
      const y = toNum(row[def.key]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return { x, y, xLabel: String(row[xKey] ?? idx) };
    });
    return { label: def.label ?? def.key, color, points };
  });

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 1;
  }
  if (!Number.isFinite(maxY)) {
    maxY = 1;
  }
  if (maxY === minY) {
    maxY = minY + 1;
  }

  const padding = { top: 16, right: 24, bottom: 32, left: 48 };
  return {
    width,
    height,
    padding,
    plotWidth: Math.max(10, width - padding.left - padding.right),
    plotHeight: Math.max(10, height - padding.top - padding.bottom),
    minX,
    maxX,
    minY,
    maxY: maxY < 0 ? 0 : maxY,
    series,
    rows: data,
    xKey,
    yKeys,
    opts: {
      legend: options.legend ?? DEFAULTS.legend,
      tooltip: options.tooltip ?? DEFAULTS.tooltip,
      a11yTable: options.a11yTable ?? DEFAULTS.a11yTable,
      locale: options.locale ?? DEFAULTS.locale,
      type: options.type,
      animate: options.animate ?? DEFAULTS.animate,
      title: options.title ?? 'Chart',
      x: options.x,
      y: options.y,
    },
  };
}
