// packages/charts/src/svg.ts
//
// Static SVG fragment builders over the normalized plot model. Pure string
// builders (no DOM), shared by SSR and client rendering.
import { PALETTE } from './types';
import { escapeXml, sx, sy, type Normalized, type NormalizedSeries } from './normalize';

export function axesSvg(n: Normalized): string {
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
  const stride =
    first && first.points.length > maxLabels ? Math.ceil(first.points.length / maxLabels) : 1;
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

export function seriesSvg(n: Normalized): string {
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

export function tooltipTitle(n: Normalized, pt: { xLabel: string; y: number }): string {
  if (!n.opts.tooltip) return '';
  const fmt = new Intl.NumberFormat(n.opts.locale, { maximumFractionDigits: 2 });
  return `<title>${escapeXml(`${pt.xLabel}: ${fmt.format(pt.y)}`)}</title>`;
}

export function pieSvg(n: Normalized, s: NormalizedSeries): string {
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

export function legendSvg(n: Normalized): string {
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

export function a11yTableHtml(n: Normalized): string {
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
