// packages/i18n/src/direction.ts
//
// helpers جهت RTL/LTR و CSS منطقی (#100) — استخراج مکانیکی از index.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { isRTL } from './jalali-compat';


// ── #100: Comprehensive RTL, Logical Direction & Bidirectional Intl Helpers ──

export const RTL_LOCALES: readonly string[] = /* @__PURE__ */ Object.freeze([
  'fa',
  'ar',
  'he',
  'ur',
  'ckb',
  'ps',
  'sd',
  'ug',
  'yi',
  'dv',
]);

const RTL_STRONG_CHAR_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG_CHAR_RE = /[A-Za-z\u00C0-\u02B8\u0370-\u052F]/;

/**
 * #100: تشخیص جهت متن بر اساس اولین کاراکتر قوی یونیکد (UAX #9 `dir="auto"`).
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' | 'auto' {
  for (const ch of text) {
    if (RTL_STRONG_CHAR_RE.test(ch)) return 'rtl';
    if (LTR_STRONG_CHAR_RE.test(ch)) return 'ltr';
  }
  return 'auto';
}

/**
 * #100: تشخیص جهت زبان/locale یا متن (`'rtl' | 'ltr'`).
 */
export function getDirection(localeOrText?: string): 'rtl' | 'ltr' {
  if (localeOrText) {
    const trimmed = localeOrText.trim();
    const baseLang = trimmed.split(/[-_]/)[0]?.toLowerCase() ?? '';
    if (RTL_LOCALES.includes(baseLang)) return 'rtl';
    if (/^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(trimmed)) return 'ltr';
    const detected = detectTextDirection(trimmed);
    if (detected !== 'auto') return detected;
  }
  return isRTL(localeOrText) ? 'rtl' : 'ltr';
}

/**
 * #100: اعمال `lang` و `dir` روی `document.documentElement` برای همگام‌سازی کامل RTL/LTR.
 */
export function applyDocumentDirection(locale: string, doc?: Document): 'rtl' | 'ltr' {
  const dir = getDirection(locale);
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (targetDoc?.documentElement) {
    targetDoc.documentElement.lang = locale;
    targetDoc.documentElement.dir = dir;
  }
  return dir;
}

/**
 * #100: ایزوله‌سازی متن دوجهته با کاراکترهای استاندارد Unicode Bidi Isolates
 * (`U+2066 LRI`، `U+2067 RLI`، `U+2068 FSI` و `U+2069 PDI`) برای جلوگیری از
 * به‌هم‌ریختگی ترتیب اعداد، شماره تلفن، URL، قیمت و کد لاتین در متن فارسی/عربی.
 */
export function isolateBidi(text: string, dir: 'rtl' | 'ltr' | 'auto' = 'auto'): string {
  const prefix = dir === 'ltr' ? '\u2066' : dir === 'rtl' ? '\u2067' : '\u2068';
  return `${prefix}${text}\u2069`;
}

/**
 * #100: محاسبهٔ گام حرکت افقی کلیدهای جهت‌نما (`ArrowLeft` / `ArrowRight`)
 * مطابق WAI-ARIA APG در محیط‌های LTR و RTL.
 */
export function resolveHorizontalStep(key: string, dir: 'rtl' | 'ltr' = 'ltr'): -1 | 0 | 1 {
  if (key === 'ArrowRight') return dir === 'rtl' ? -1 : 1;
  if (key === 'ArrowLeft') return dir === 'rtl' ? 1 : -1;
  return 0;
}

/**
 * #100: نگاشت ویژگی‌های فیزیکی CSS به ویژگی‌های منطقی (CSS Logical Properties).
 */
export const LOGICAL_CSS_MAP: Readonly<Record<string, string>> = /* @__PURE__ */ Object.freeze({
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  'border-left-color': 'border-inline-start-color',
  'border-right-color': 'border-inline-end-color',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
});

/**
 * #100: تبدیل خودکار استایل‌های فیزیکی افقی (`margin-left`, `padding-right`, `left`, `text-align: left/right`)
 * به معادل‌های CSS Logical Properties برای سازگاری کامل با RTL/LTR.
 */
export function toLogicalCss(cssText: string): string {
  let out = cssText;
  for (const [physical, logical] of Object.entries(LOGICAL_CSS_MAP)) {
    const re = new RegExp(`(^|[;\\s{])${physical}(\\s*:)`, 'gi');
    out = out.replace(re, `$1${logical}$2`);
  }
  out = out
    .replace(/text-align\s*:\s*left\b/gi, 'text-align: start')
    .replace(/text-align\s*:\s*right\b/gi, 'text-align: end');
  return out;
}