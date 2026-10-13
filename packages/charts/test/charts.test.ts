// packages/charts/test/charts.test.ts
// @vitest-environment jsdom
/* global document */
import { describe, it, expect } from 'vitest';
import { createChart, renderChartSvg, processChart, DEFAULTS } from '../src/index';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

const DATA = [
  { day: 'شنبه', value: 10, alt: 4 },
  { day: 'یکشنبه', value: 18, alt: 9 },
  { day: 'دوشنبه', value: 12, alt: 6 },
];

describe('@zenith/charts (#169)', () => {
  it('renderChartSvg بدون document برای SSR رندر می‌کند', () => {
    const svg = renderChartSvg(
      { type: 'line', data: DATA, x: 'day', y: 'value', title: 'فروش' },
      DATA,
    );
    expect(svg).toContain('<svg');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="فروش"');
    expect(svg).toContain('polyline');
  });

  it('پنج نوع نمودار بدون استثنا رندر می‌شوند', () => {
    for (const type of ['line', 'area', 'bar', 'pie', 'scatter'] as const) {
      const svg = renderChartSvg({ type, data: DATA, x: 'day', y: 'value' }, DATA);
      expect(svg.length).toBeGreaterThan(50);
      expect(svg).toContain('</svg>');
    }
  });

  it('createChart ری‌اکتیو است و update رندر مجدد می‌کند', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const chart = createChart(el, { type: 'bar', data: DATA, x: 'day', y: 'value' });
    expect(el.innerHTML).toContain('rect');
    chart.update([{ day: 'سه‌شنبه', value: 25 }]);
    flushSync();
    expect(el.innerHTML).toContain('سه‌شنبه');
    chart.dispose();
    expect(el.innerHTML).toBe('');
  });

  it('ورودی data می‌تواند سیگنال باشد و به‌روزرسانی reactive بنشیند', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const dataSig = signal([...DATA]);
    const chart = createChart(el, {
      type: 'line',
      data: dataSig as unknown as never,
      x: 'day',
      y: 'value',
    });
    dataSig.set([{ day: 'چهارشنبه', value: 30 }]);
    flushSync();
    expect(el.innerHTML).toContain('چهارشنبه');
    chart.dispose();
  });

  it('جدول جایگزین a11y در DOM قرار می‌گیرد', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const chart = createChart(el, { type: 'pie', data: DATA, x: 'day', y: 'value', title: 'سهم' });
    const table = el.querySelector('table.zen-chart-a11y');
    expect(table).toBeTruthy();
    expect(table?.querySelector('caption')?.textContent).toBe('سهم');
    chart.dispose();
  });

  it('toImage دیتا-یوآرل SVG برمی‌گرداند', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const chart = createChart(el, { type: 'scatter', data: DATA, x: 'day', y: 'value' });
    const url = chart.toImage();
    expect(url).toContain('data:image/svg+xml');
    chart.dispose();
  });

  it('processChart دیتاکلید را bind و options JSON را ادغام می‌کند', () => {
    const el = document.createElement('div');
    el.setAttribute('zen-chart', '$rows');
    el.setAttribute('zen-chart-type', 'bar');
    el.setAttribute('zen-chart-x', 'day');
    el.setAttribute('zen-chart-y', 'value');
    document.body.appendChild(el);
    const ctx = { rows: [...DATA] };
    const dispose = processChart(el, '$rows', ctx as Record<string, never>);
    expect(el.innerHTML).toContain('rect');
    dispose();
    expect(el.innerHTML).toBe('');
  });

  it('DEFAULTS منجمد است و شامل مقادیر بند spec است', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(DEFAULTS.height).toBe(300);
    expect(DEFAULTS.a11yTable).toBe(true);
  });
});
