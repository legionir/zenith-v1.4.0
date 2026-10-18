import type { ZenApi } from './api-types';
const CLOAK_STYLE_ID = 'zenith-cloak-style';

/**
 * FEATURE (v0.6.0): لیست دایرکتیوهایی که ممکن است قبل از hydration
 * باعث FOUC شوند.
 *
 * این attributeها روی عناصر قرار می‌گیرند و browser قبل از اجرای Zen.start
 * نمی‌داند که باید چه کار با آنها بکند. به همین دلیل CSS ضد-FOUC آنها را
 * تا زمان پردازش مخفی می‌کند.
 */
const CLOAK_DIRECTIVES = [
  'zen-if',
  'zen-for',
  'zen-show',
  'zen-text',
  'zen-html',
  'zen-html-trusted',
  'zen-model',
  'zen-bind',
  'zen-resource',
  'zen-fetch',
  'zen-cloak',
  'zen-resource-view',
  'zen-action-button',
  'zen-auth-view',
];


/** Private cloak implementation. @internal */
export function cloakCSS(): string {
    // FEATURE (v0.6.0): تولید CSS ضد-FOUC.
    // نکته: visibility:hidden به‌جای display:none تا layout حفظ شود.
    // استفاده از !important تا توسط استایل‌های کاربر override نشود.
    const selectors = CLOAK_DIRECTIVES.map((d) => `[${d}]`).join(',\n  ');
    return `  ${selectors} {\n    visibility: hidden !important;\n  }\n`;
  }

/** Private cloak implementation. @internal */
export function injectCloakStyle(api: ZenApi): boolean {
    // FEATURE (v0.6.0): تزریق style tag به head (idempotent + SSR-safe).
    if (typeof document === 'undefined' || !document.head) return false;
    // اگر از قبل وجود داشت و به head متصل است، دوباره تزریق نکن.
    const existing = document.getElementById(CLOAK_STYLE_ID);
    if (existing && existing.parentNode === document.head) return false;
    // اگر وجود دارد اما detached است (مثلاً بعد از SSR hydration)، آن را حذف کن
    if (existing && existing.parentNode !== document.head) {
      existing.remove();
    }
    const style = document.createElement('style');
    style.id = CLOAK_STYLE_ID;
    style.textContent = api.cloakCSS();
    // prepend تا اولویت پایین‌تری از استایل‌های کاربر داشته باشد (هرچند
    // !important این تضمین را از قبل می‌دهد).
    document.head.prepend(style);
    return true;
  }

/** Private cloak implementation. @internal */
export function removeCloakStyle(): void {
    // FEATURE (v0.6.0): حذف style tag از head (SSR-safe).
    if (typeof document === 'undefined' || !document.head) return;
    const existing = document.getElementById(CLOAK_STYLE_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }
