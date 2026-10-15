// packages/theme/src/directives.ts
//
// دایرکتیوهای `zen-theme*` / `zen-dir` (#161) به‌صورت director-
// functions که runtime-core walker صدا می‌زند.
//
//   zen-theme            — bind مقدار «theme name» نیست؛ وجودی (mount hook)
//   zen-theme-toggle     — کلیک ⇒ theme.toggle()؛ aria-pressed خودکار
//   zen-theme-mode       — bind متن/وضعیت mode (مثل radio button set)
//   zen-dir              — انتخاب جهت محلی (ltr/rtl/auto) برای subtree

import { effect } from '@zenith/state';
import type { Theme } from './theme';

/** رجیستری داخلی — توسط theme directives استفاده می‌شود. */
let activeTheme: Theme | null = null;

export function setActiveTheme(theme: Theme | null): void {
  activeTheme = theme;
}

export function getActiveTheme(): Theme | null {
  return activeTheme;
}

/**
 * #161: `zen-theme-toggle` — toggle روشن/تاریک با aria-pressed.
 * مقدار attribute نادیده گرفته می‌شود (نامتمایز از toggle خودکار).
 */
export function processThemeToggle(el: HTMLElement, _expr: string): () => void {
  const theme = activeTheme;
  if (!theme) return () => {};

  const sync = effect(() => {
    el.setAttribute('aria-pressed', theme.resolved.get() === 'dark' ? 'true' : 'false');
  });
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', el.getAttribute('aria-label') ?? 'تغییر تم');

  const onClick = (ev: Event): void => {
    ev.preventDefault();
    theme.toggle();
  };
  el.addEventListener('click', onClick);

  return () => {
    sync();
    el.removeEventListener('click', onClick);
  };
}

/**
 * #161: `zen-theme-mode="light|dark|system"` — ست کردن mode واکنشی.
 * برای radio group ها: هر گزینه مقدار خود را دارد و active-class بر اساس mode.
 */
export function processThemeMode(el: HTMLElement, expr: string): () => void {
  const theme = activeTheme;
  if (!theme) return () => {};
  const target = expr.trim() as 'light' | 'dark' | 'system';
  if (target !== 'light' && target !== 'dark' && target !== 'system') return () => {};

  const sync = effect(() => {
    const active = theme.mode.get() === target;
    el.classList.toggle('zen-theme-active', active);
    el.setAttribute('aria-checked', active ? 'true' : 'false');
  });

  const onClick = (ev: Event): void => {
    ev.preventDefault();
    theme.setMode(target);
  };
  el.addEventListener('click', onClick);

  return () => {
    sync();
    el.removeEventListener('click', onClick);
  };
}

/**
 * #161: `zen-dir="ltr|rtl"` — لغو جهت برای یک subtree (
 * مثل باکس کد LTR در صفحهٔ RTL).
 */
export function processDir(el: HTMLElement, expr: string): () => void {
  const dir = expr.trim();
  if (dir !== 'ltr' && dir !== 'rtl' && dir !== 'auto') return () => {};
  const prev = el.getAttribute('dir');
  el.setAttribute('dir', dir === 'auto' ? (getActiveTheme()?.dir.get() ?? 'ltr') : dir);
  return () => {
    if (prev === null) el.removeAttribute('dir');
    else el.setAttribute('dir', prev);
  };
}
