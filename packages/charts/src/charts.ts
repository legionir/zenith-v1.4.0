// packages/charts/src/charts.ts
//
// @zenith/charts (#169) — نمودار SVG واکنشی L2:
//   line / area / bar / pie / scatter، جدول جایگزین a11y، tooltip ساده،
//   احترام به prefers-reduced-motion، رندر ایستای SSR.

import { signal, effect, type Signal, type ReadonlySignal } from '@zenith/state';
import { s, defineOptions, type Schema } from '@zenith/schema';
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

const PALETTE = /* @__PURE__ */ Object.freeze([
  '#4f7cff', '#34a853', '#f9a825', '#d93025', '#9c27b0', '#00bcd4', '#ff7043', '#607d8b',
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#x22;');
}

export function prefersReducedMotion(doc?: Document): boolean {
  const view = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  if (view && typeof view.matchMedia === 'function') {
    try {
      return view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* fall through */
    }
  }
  return false;
}

function toNum(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface NormalizedSeries {
  label: string;
  color: string;
  points: { x: number; y: number; xLabel: string }[];
}

interface Normalized {
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

function sx(n: Normalized, x: number): number {
  const span = n.maxX - n.minX;
  if (span === 0) return n.padding.left + n.plotWidth / 2;
  return n.padding.left + ((x - n.minX) / span) * n.plotWidth;
}

function sy(n: Normalized, y: number): number {
  const span = n.maxY - n.minY;
  if (span === 0) return n.padding.top + n.plotHeight / 2;
  return n.padding.top + n.plotHeight - ((y - n.minY) / span) * n.plotHeight;
}

function buildNormalized(options: ChartOptions, data: ChartRow[]): Normalized {
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

  if (!Number.isFinite(minX)) { minX = 0; maxX = 1; }
  if (!Number.isFinite(maxY)) { maxY = 1; }
  if (maxY === minY) { maxY = minY + 1; }

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

function axesSvg(n: Normalized): string {
  const { padding, plotWidth, plotHeight } = n;
  const x2 = padding.left + plotWidth;
  const y2 = padding.top + plotHeight;
  const ticks: string[] = [];
  const fmt = new Intl.NumberFormat(n.opts.locale, { maximumFractionDigits: 1 });
  for (let i = 0; i <= 4; i++) {
    const yVal = n.minY + ((n.maxY - n.minY) * i) / 4;
    const py = sy(n, yVal);
    ticks.push(
      `<line x1="${padding.left}" y1="${py}" x2="${x2}" y2="${py}" stroke="#e3e3e3" stroke-width="1"/>` +
      `<text x="${padding.left - 6}" y="${py + 4}" text-anchor="end" font-size="10" fill="currentColor">${escapeXml(fmt.format(yVal))}</text>`,
    );
  }
  const first = n.series[0];
  const maxLabels = 6;
  const stride = first && first.points.length > maxLabels ? Math.ceil(first.points.length / maxLabels) : 1;
  if (first) {
    first.points.forEach((pt, idx) => {
      if (idx % stride !== 0 && first.points.length > 2) return;
      const px = sx(n, pt.x);
      ticks.push(
        `<text x="${px}" y="${y2 + 16}" text-anchor="middle" font-size="9" fill="currentColor" transform="rotate(0)">${escapeXml(pt.xLabel.slice(0, 18))}</text>`,
      );
    });
  }
  return (
    `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${y2}" stroke="currentColor" stroke-width="1" opacity="0.6"/>` +
    `<line x1="${padding.left}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" opacity="0.6"/>` +
    ticks.join('')
  );
}

function seriesSvg(n: Normalized): string {
  const parts: string[] = [];
  for (const s of n.series) {
    switch (n.opts.type) {
      case 'line':
      case 'area': {
        if (s.points.length === 0) break;
        const line = s.points
          .map((pt) => `${sx(n, pt.x).toFixed(2)},${sy(n, pt.y).toFixed(2)}`)
          .join(' ');
        if (n.opts.type === 'area') {
          const y0 = sy(n, n.minY);
          const firstX = sx(n, s.points[0]!.x);
          const lastX = sx(n, s.points[s.points.length - 1]!.x);
          parts.push(
            `<polygon points="${firstX},${y0} ${line} ${lastX},${y0}" fill="${s.color}" fill-opacity="0.18"/>`,
          );
        }
        parts.push(
          `<polyline points="${line}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
        );
        for (const pt of s.points) {
          parts.push(
            `<circle cx="${sx(n, pt.x).toFixed(2)}" cy="${sy(n, pt.y).toFixed(2)}" r="3" fill="${s.color}">${tooltipTitle(n, pt)}</circle>`,
          );
        }
        break;
      }
      case 'bar': {
        const count = s.points.length;
        const slot = n.plotWidth / Math.max(1, count);
        const barWidth = Math.max(1, Math.min(48, slot * 0.6));
        s.points.forEach((pt, idx) => {
          const cx = n.padding.left + slot * (idx + 0.5);
          const h = sy(n, n.minY) - sy(n, pt.y);
          const y = sy(n, Math.max(pt.y, n.minY));
          parts.push(
            `<rect x="${(cx - barWidth / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.abs(h).toFixed(2)}" fill="${s.color}" rx="2">${tooltipTitle(n, pt)}</rect>`,
          );
        });
        break;
      }
      case 'scatter': {
        for (const pt of s.points) {
          parts.push(
            `<circle cx="${sx(n, pt.x).toFixed(2)}" cy="${sy(n, pt.y).toFixed(2)}" r="4" fill="${s.color}" opacity="0.85">${tooltipTitle(n, pt)}</circle>`,
          );
        }
        break;
      }
      case 'pie': {
        // pie را به‌صورت جداگانه در pieSvg تولید می‌کنیم.
        parts.push(pieSvg(n, s));
        break;
      }
    }
  }
  return parts.join('');
}

function tooltipTitle(n: Normalized, pt: { xLabel: string; y: number }): string {
  if (!n.opts.tooltip) return '';
  const fmt = new Intl.NumberFormat(n.opts.locale, { maximumFractionDigits: 2 });
  return `<title>${escapeXml(`${pt.xLabel}: ${fmt.format(pt.y)}`)}</title>`;
}

function pieSvg(n: Normalized, s: NormalizedSeries): string {
  const total = s.points.reduce((acc, p) => acc + Math.max(0, p.y), 0) || 1;
  const cx = n.padding.left + n.plotWidth / 2;
  const cy = n.padding.top + n.plotHeight / 2;
  const r = Math.min(n.plotWidth, n.plotHeight) / 2;
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  const fmt = new Intl.NumberFormat(n.opts.locale, { maximumFractionDigits: 1 });
  s.points.forEach((pt, i) => {
    const frac = Math.max(0, pt.y) / total;
    const nextAngle = angle + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(nextAngle);
    const y2 = cy + r * Math.sin(nextAngle);
    const large = frac > 0.5 ? 1 : 0;
    const color = PALETTE[i % PALETTE.length]!;
    parts.push(
      `<path d="M ${cx.toFixed(2)} ${cy.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}"><title>${escapeXml(`${pt.xLabel}: ${fmt.format(pt.y)} (${(frac * 100).toFixed(1)}%)`)}</title></path>`,
    );
    angle = nextAngle;
  });
  return parts.join('');
}

function legendSvg(n: Normalized): string {
  if (!n.opts.legend || n.opts.type === 'pie') return '';
  const items = n.series
    .map((s, i) => {
      const y = 8 + i * 16;
      return (
        `<rect x="${n.width - n.padding.right - 96}" y="${y - 8}" width="10" height="10" fill="${s.color}" rx="2"/>` +
        `<text x="${n.width - n.padding.right - 82}" y="${y}" font-size="10" fill="currentColor">${escapeXml(s.label)}</text>`
      );
    })
    .join('');
  return `<g aria-hidden="true">${items}</g>`;
}

function a11yTableHtml(n: Normalized): string {
  if (!n.opts.a11yTable) return '';
  const headers = n.series.map((s) => `<th scope="col">${escapeXml(s.label)}</th>`).join('');
  const first = n.series[0];
  if (!first) return '';
  const body = first.points
    .map((pt, i) => {
      const cells = n.series
        .map((s) => `<td>${escapeXml(String(s.points[i]?.y ?? ''))}</td>`)
        .join('');
      return `<tr><th scope="row">${escapeXml(pt.xLabel)}</th>${cells}</tr>`;
    })
    .join('');
  return (
    `<table class="zen-chart-a11y" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="false">` +
    `<caption>${escapeXml(n.opts.title)}</caption><thead><tr><th scope="col">${escapeXml(n.xKey)}</th>${headers}</tr></thead><tbody>${body}</tbody></table>`
  );
}

/**
 * #169: رندر SVG ایستا — هم SSR (بدون document) هم client.
 */
export function renderChartSvg(options: ChartOptions, data: ChartRow[]): string {
  const n = buildNormalized(options, data);
  const isPie = n.opts.type === 'pie';
  const motion = options.animate && !prefersReducedMotion();
  const motionStyle = motion && (n.opts.type === 'line' || n.opts.type === 'area')
    ? '<style>@keyframes zen-chart-draw{from{stroke-dasharray:0 1000}to{opacity:1}}</style>'
    : '';
  const content = isPie
    ? seriesSvg(n)
    : `${axesSvg(n)}${seriesSvg(n)}${legendSvg(n)}`;
  return (
    `<svg role="img" aria-label="${escapeXml(n.opts.title)}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${n.width} ${n.height}" width="100%" height="${n.height}" preserveAspectRatio="xMidYMid meet">${motionStyle}${content}</svg>`
  );
}

function isSignal<T>(value: unknown): value is ReadonlySignal<T> {
  return typeof value === 'object' && value !== null && typeof (value as { get?: () => T }).get === 'function';
}

/**
 * #169: ساخت نمودار واکنشی — update روی data سیگنال هم کار می‌کند.
 */
export function createChart(
  el: HTMLElement,
  options: ChartOptions,
): Chart {
  const dataSig: Signal<ChartRow[]> = isSignal<ChartRow[]>(options.data)
    ? (options.data as ReadonlySignal<ChartRow[]>) as Signal<ChartRow[]>
    : signal((options.data as ChartRow[]) ?? []);

  const render = (): void => {
    el.innerHTML = `${renderChartSvg(options, dataSig.get())}${a11yTableHtml(buildNormalized(options, dataSig.get()))}`;
  };

  render();

  const stop = effect(() => {
    const d = dataSig.get();
    el.innerHTML = `${renderChartSvg(options, d)}${a11yTableHtml(buildNormalized(options, d))}`;
  });

  const chart: Chart = {
    update(next: ChartRow[]): void {
      dataSig.set(next);
    },
    resize(): void {
      render();
    },
    toImage(): string {
      const svg = renderChartSvg(options, dataSig.get());
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },
    dispose(): void {
      stop();
      el.innerHTML = '';
    },
  };
  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    (chart as any)[Symbol.dispose] = () => chart.dispose();
  }
  return chart;
}
