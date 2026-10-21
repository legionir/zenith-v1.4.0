// packages/charts/src/charts.ts
//
// @zenith/charts (#169) — reactive chart factory + static SSR render.
// Shapes live in `./types`, data scaling in `./normalize`, SVG fragments in
// `./svg`; this module only wires them to signals/effects.
import { signal, effect, type Signal, type ReadonlySignal } from '@zenith/state';
import { prefersReducedMotion } from '@zenith/shared';
import { buildNormalized, escapeXml } from './normalize';
import { a11yTableHtml, axesSvg, legendSvg, seriesSvg } from './svg';
import type { Chart, ChartOptions, ChartRow } from './types';

// #119: پیاده‌سازی یکتا در @zenith/shared (media.ts) است؛ اینجا فقط
// re-export می‌شود تا نام عمومی پکیج حفظ شود (بدون پیاده‌سازی تکراری).
export { prefersReducedMotion };

/**
 * #169: رندر SVG ایستا — هم SSR (بدون document) هم client.
 */
export function renderChartSvg(options: ChartOptions, data: ChartRow[]): string {
  const n = buildNormalized(options, data);
  const isPie = n.opts.type === 'pie';
  const motion = options.animate && !prefersReducedMotion();
  const motionStyle =
    motion && (n.opts.type === 'line' || n.opts.type === 'area')
      ? '<style>@keyframes zen-chart-draw{from{stroke-dasharray:0 1000}to{opacity:1}}</style>'
      : '';
  const content = isPie ? seriesSvg(n) : `${axesSvg(n)}${seriesSvg(n)}${legendSvg(n)}`;
  return (
    `<svg role="img" aria-label="${escapeXml(n.opts.title)}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${n.width} ${n.height}" width="100%" height="${n.height}" preserveAspectRatio="xMidYMid meet">${motionStyle}${content}</svg>`
  );
}

function isSignal<T>(value: unknown): value is ReadonlySignal<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { get?: () => T }).get === 'function'
  );
}

/**
 * #169: ساخت نمودار واکنشی — update روی data سیگنال هم کار می‌کند.
 */
export function createChart(el: HTMLElement, options: ChartOptions): Chart {
  const dataSig: Signal<ChartRow[]> = isSignal<ChartRow[]>(options.data)
    ? (options.data as ReadonlySignal<ChartRow[]> as Signal<ChartRow[]>)
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
    Reflect.set(chart, Symbol.dispose, () => chart.dispose());
  }
  return chart;
}
