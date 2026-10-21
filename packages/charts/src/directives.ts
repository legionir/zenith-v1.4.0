// packages/charts/src/directives.ts
//
// #169: `zen-chart="dataExpr"` — نمودار واکنشی درون عنصر.
//   zen-chart-type, zen-chart-x, zen-chart-y, zen-chart-series (JSON),
//   zen-chart-height, zen-chart-legend, zen-chart-aria-label, zen-chart-options (JSON)

import { parseJsonAttr } from '@zenith/schema/attr';
import { createChart } from './charts';
import type { Chart, ChartOptions, ChartRow, ChartType } from './types';

export function processChart(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
): () => void {
  const resolveData = (): ChartRow[] => {
    const trimmed = expr.trim();
    // 1) اشاره به سیگنال state (با یا بدون $)
    const key = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
    const raw =
      (context as Record<string, unknown>)[key] ?? (context as Record<string, unknown>)[`$${key}`];
    if (Array.isArray(raw)) return raw as ChartRow[];
    if (
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as { get?: () => unknown }).get === 'function'
    ) {
      const v = (raw as { get: () => unknown }).get();
      return Array.isArray(v) ? (v as ChartRow[]) : [];
    }
    // 2) عدد ساده ⇒ فقط readonly empty
    return [];
  };

  const data = resolveData();
  const typeAttr = (el.getAttribute('zen-chart-type') ?? 'line').trim() as ChartType;
  const type: ChartType = ['line', 'area', 'bar', 'pie', 'scatter'].includes(typeAttr)
    ? typeAttr
    : 'line';
  const xKey = el.getAttribute('zen-chart-x') ?? 'x';
  const yAttr = el.getAttribute('zen-chart-y') ?? 'y';
  const yKeys = yAttr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const y: string | string[] = yKeys.length > 1 ? yKeys : (yKeys[0] ?? 'y');

  // #120: خواندن attribute از طریق helper مشترک (@zenith/schema) — JSON خراب
  // دیگر با try/catch پراکنده مدیریت نمی‌شود و خطا کد ZEN-1003 می‌گیرد.
  const extra = parseJsonAttr<Partial<ChartOptions>>(el, 'zen-chart-options', {
    fallback: {},
  });

  const chart: Chart = createChart(el, {
    type,
    data,
    x: xKey,
    y,
    height: el.getAttribute('zen-chart-height')
      ? Number(el.getAttribute('zen-chart-height'))
      : undefined,
    width: el.getAttribute('zen-chart-width')
      ? Number(el.getAttribute('zen-chart-width'))
      : undefined,
    legend: el.getAttribute('zen-chart-legend') !== 'false',
    title: el.getAttribute('zen-chart-aria-label') ?? 'Chart',
    ...extra,
  });

  return () => chart.dispose();
}
