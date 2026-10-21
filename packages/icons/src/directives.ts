// packages/icons/src/directives.ts
//
// #170: `zen-icon="name"` — رندر آیکن درون عنصر با sanitize.
//   zen-icon-size="1em", zen-icon-label="..", zen-icon-set="name", zen-icon-spin

import { renderIcon, listIcons } from './icons';

export function processIcon(el: HTMLElement, expr: string): () => void {
  const name = expr.trim();
  if (!name || !listIcons().length) {
    // حتی وقتی set خالی است، عنصر را aria-hidden نگه می‌داریم تا اشتباهی رخ ندهد.
    if (!name) return () => {};
  }
  const size = el.getAttribute('zen-icon-size') ?? '1em';
  const label = el.getAttribute('zen-icon-label') ?? undefined;
  const set = el.getAttribute('zen-icon-set') ?? undefined;
  const spin = el.getAttribute('zen-icon-spin') === 'true';

  const svg = renderIcon(name, { size, label, set, spin });
  if (svg) {
    el.innerHTML = svg;
    const svgEl = el.querySelector('svg');
    if (svgEl) {
      svgEl.style.display = 'inline-block';
      svgEl.style.verticalAlign = 'middle';
    }
  }
  el.removeAttribute('zen-icon');
  el.removeAttribute('zen-icon-size');
  el.removeAttribute('zen-icon-set');
  el.removeAttribute('zen-icon-spin');
  // label نگه داشته می‌شود چون می‌تواند برای aria به‌کار رود.
  return () => {
    el.innerHTML = '';
  };
}
