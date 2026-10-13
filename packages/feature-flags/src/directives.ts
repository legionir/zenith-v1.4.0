// packages/feature-flags/src/directives.ts
//
// دایرکتیوهای `zen-flag*` (#168):
//   zen-flag="name"             — عنصر فقط وقتی فعال است که flag روشن باشد
//   zen-flag-else               — محتوای جایگزین (template)
//   zen-flag-variant="name:val" — فقط اگر variant برابر val باشد نمایش بده
//   zen-flag-default="true|false" — مقدار پیش‌فرض اگر flag تعریف نشده باشد

import { effect } from '@zenith/state';
import type { Flags } from './flags';

let activeFlags: Flags | null = null;

export function setActiveFlags(flags: Flags | null): void {
  activeFlags = flags;
}

export function getActiveFlags(): Flags | null {
  return activeFlags;
}

function parseBoolAttr(el: HTMLElement, name: string, fallback: boolean): boolean {
  const raw = el.getAttribute(name);
  if (raw === null) return fallback;
  return raw === 'true' || raw === '1' || raw === '';
}

/**
 * #168: `zen-flag="name"` — نمایش/پنهان واکنشی بر اساس flag.
 * `zen-flag-else` به‌صورت template در کنار عنصر نمایش fallback می‌دهد.
 */
export function processFlag(el: HTMLElement, expr: string): () => void {
  const flags = activeFlags;
  if (!flags) return () => {};
  const name = expr.trim();
  if (!name) return () => {};
  const def = parseBoolAttr(el, 'zen-flag-default', false);

  let fallbackEl: HTMLElement | null = null;
  const fallbackTemplate = el.querySelector(':scope > template[zen-flag-else]') as HTMLTemplateElement | null;
  if (fallbackTemplate) {
    fallbackEl = document.createElement('div');
    fallbackEl.style.display = 'none';
    fallbackEl.innerHTML = fallbackTemplate.innerHTML;
    el.appendChild(fallbackEl);
    fallbackTemplate.remove();
  }

  const sig = flags.flag(name, def);
  const sync = effect(() => {
    const on = sig.get();
    el.style.display = on ? '' : 'none';
    if (fallbackEl) fallbackEl.style.display = on ? 'none' : '';
  });

  return () => {
    sync();
    fallbackEl?.remove();
  };
}

/**
 * #168: `zen-flag-variant="name:expected"` — نمایش وقتی variant برابر expected است.
 */
export function processFlagVariant(el: HTMLElement, expr: string): () => void {
  const flags = activeFlags;
  if (!flags) return () => {};
  const trimmed = expr.trim();
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return () => {};
  const name = trimmed.slice(0, colon).trim();
  const expected = trimmed.slice(colon + 1).trim();

  const sig = flags.variant(name);
  const sync = effect(() => {
    el.style.display = sig.get() === expected ? '' : 'none';
  });

  return () => sync();
}
