/** Directive classification identities shared by all compilation owners. */
/** @internal */
export const STRUCTURAL_DIRECTIVES = new Set(['zen-for', 'zen-if', 'zen-else-if', 'zen-else', 'zen-show']);

// Pairs of structural directives that are mutually exclusive (cannot coexist on one element).
// zen-if + zen-else/zen-else-if is ALLOWED (chain them).
/** @internal */
export const STRUCTURAL_CONFLICT_MATRIX: Array<[string, string]> = [
  ['zen-for', 'zen-if'],
  ['zen-for', 'zen-else-if'],
  ['zen-for', 'zen-else'],
  ['zen-for', 'zen-show'],
  ['zen-show', 'zen-if'],
  ['zen-show', 'zen-else-if'],
  ['zen-show', 'zen-else'],
];

/** @public */
export const COMPILABLE_DIRECTIVES = new Set([
  'zen-text',
  'zen-if',
  'zen-show',
  'zen-bind',
  'zen-html',
  // FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
  // مثل zen-html اما به‌جای sanitizeHTML از sanitizeHTMLTrusted (Identity
  // function + dev warn) استفاده می‌کند. در compileCompilableDirective یک
  // case جدا دارد چون به پارامتر هشتم render (sanitizeHTMLTrusted) متصل است.
  'zen-html-trusted',
  'zen-model',
  'zen-for', // v0.3.0: keyed-diffing compiled (child directives via processChildren)
]);

/**
 * Directiveهایی که نیاز به runtime infrastructure دارند و قابل compile نیستند.
 *
 * این directiveها روی عنصر حفظ می‌شوند (setAttribute) و runtime walker
 * پس از render() آن‌ها را پردازش می‌کند.
 */
/** @public */
export const RUNTIME_DIRECTIVES = new Set([
  'zen-action',
  'zen-fetch',
  'zen-resource',
  'zen-link',
  'zen-permission',
  'zen-role',
  'zen-error',
  'zen-suspense',
  'zen-virtual-list',
  'zen-component',
  'zen-validate',
  'zen-transition',
  // FEATURE (v0.5.0): zen-animate — Web Animations API directive.
  // این دایرکتیو در runtime توسط walker پردازش می‌شود (keyframes و presets
  // در @zenith/transition هستند) و قابل compile نیست. compiler آن را به‌صورت
  // attribute روی عنصر حفظ می‌کند تا walker پس از render() آن را ببیند.
  'zen-animate',
  'zen-cloak',
  'zen-ref',
  // FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
  //  - zen-portal:        عنصر را به یک container دیگر منتقل می‌کند (مثلاً modal به body).
  //                       نیاز به document.querySelector دارد → فقط در runtime قابل اجرا.
  //  - zen-intersection:  IntersectionObserver می‌سازد → نیاز به browser API دارد.
  //  - zen-cloak و zen-ref قبلاً ثبت شده بودند (در بالا).
  'zen-portal',
  'zen-intersection',
  'zen-props',
  'zen-key',
  // FEATURE (v1.0.0): zen-static — fast path attribute برای zen-for.
  // این attribute توسط runtime processFor خوانده می‌شود (el.hasAttribute).
  // compiler آن را روی element حفظ می‌کند تا runtime بتواند fast path را فعال کند.
  'zen-static',
  'zen-item-height',
  'zen-buffer',
  'zen-dynamic-heights',
  'zen-html-slot',
  'zen-route',
  'zen-outlet',
  'zen-form',
  'zen-field',
  'zen-submit',
  'zen-store',
  'zen-auth',
  'zen-login',
  'zen-logout',
  // IMPROVEMENT-05 (v1.0.1): zen-else و zen-else-if — runtime chain processing.
  'zen-else',
  'zen-else-if',
  // FIX (v1.2.7): six runtime directives were missing — the compiler
  // silently dropped them (treated as unknown) which meant that compiled
  // output lost zen-track (analytics), zen-date-picker, zen-optimistic,
  // zen-island, zen-memo, and zen-virtual attributes on elements. They
  // are runtime-only (need walker / browser APIs) so they belong here,
  // not in COMPILABLE_DIRECTIVES.
  'zen-track',
  'zen-date-picker',
  'zen-optimistic',
  'zen-island',
  'zen-memo',
  'zen-virtual',
  // #138: ۶ دایرکتیو فقط-runtime در walker.ts که اکنون صراحتاً در RUNTIME_DIRECTIVES ثبت شده‌اند
  'zen-resource-view',
  'zen-action-button',
  'zen-auth-view',
  'zen-router',
  'zen-button',
  'zen-if-chain',
]);

