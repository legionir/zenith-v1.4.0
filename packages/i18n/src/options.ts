// packages/i18n/src/options.ts — schema گزینه‌های i18n (#150, #52).
//
// پیش‌فرض‌ها (I18N_DEFAULTS) + اعتبارسنجی مرزی (defineOptions/#52) برای تمام
// فیلدهای spec. مقادیر وابسته به locale (calendar/numberingSystem/currency)
// در resolveI18nOptions محاسبه می‌شوند.

import { s, defineOptions } from '@zenith/schema';
import type { I18nOptions, Messages, MissingStrategy, DetectSource } from './types';

const isStringOrStringArray = (v: unknown): boolean =>
  typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string'));

const isRecordNonNull = (v: unknown): boolean => typeof v === 'object' && v !== null;

const isDetectArray = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((x) => ['query', 'cookie', 'storage', 'navigator', 'path'].includes(String(x)));

const isStringArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

const isPersist = (v: unknown): boolean => v === false || (typeof v === 'string' && v.length > 0);

/** پیش‌فرض‌های spec (§۳.۱) — فریز؛ قرارداد «پیش‌فرض‌ها تغییر نمی‌کنند» (SPEC §۴.۳). */
export const I18N_DEFAULTS = /* @__PURE__ */ Object.freeze({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {} as Record<string, Messages>,
  detect: [] as readonly DetectSource[],
  detectKey: 'lang',
  persist: 'zen.locale' as string | false,
  missing: 'key' as MissingStrategy,
  warnOnMissing: true,
  numberFormats: {} as Record<string, Intl.NumberFormatOptions>,
  dateFormats: {} as Record<string, Intl.DateTimeFormatOptions>,
  calendar: 'gregory' as const,
  numberingSystem: 'latn' as const,
  timeZone: 'UTC',
  escapeParams: true,
  syncDocument: true,
  rtlLocales: ['fa', 'ar', 'he', 'ur'] as readonly string[],
  defaultCurrency: 'USD',
});

export const i18nOptionsSchema = defineOptions<I18nOptions>(
  'I18nOptions',
  s.object({
    locale: s.optional(s.string({ min: 2 })),
    fallbackLocale: s.optional(
      s.custom<string | readonly string[]>(isStringOrStringArray, 'string | string[]'),
    ),
    messages: s.optional(s.custom<Record<string, Messages>>(isRecordNonNull, 'messages object')),
    loadMessages: s.optional(
      s.custom<(locale: string) => Promise<Messages>>((v) => typeof v === 'function', 'loader fn'),
    ),
    detect: s.optional(s.custom<readonly DetectSource[]>(isDetectArray, 'detect sources[]')),
    detectKey: s.optional(s.string({ min: 1 })),
    persist: s.optional(s.custom<string | false>(isPersist, 'string | false')),
    missing: s.optional(s.enum(['key', 'empty', 'throw'] as const)),
    warnOnMissing: s.optional(s.boolean()),
    numberFormats: s.optional(
      s.custom<Record<string, Intl.NumberFormatOptions>>(isRecordNonNull, 'object'),
    ),
    dateFormats: s.optional(
      s.custom<Record<string, Intl.DateTimeFormatOptions>>(isRecordNonNull, 'object'),
    ),
    calendar: s.optional(s.enum(['gregory', 'persian'] as const)),
    numberingSystem: s.optional(s.enum(['latn', 'arab', 'arabext'] as const)),
    timeZone: s.optional(s.string({ min: 1 })),
    escapeParams: s.optional(s.boolean()),
    syncDocument: s.optional(s.boolean()),
    rtlLocales: s.optional(s.custom<readonly string[]>(isStringArray, 'string[]')),
    defaultCurrency: s.optional(s.string({ min: 3, max: 3 })),
    sanitizeHtml: s.optional(
      s.custom<(html: string) => string>((v) => typeof v === 'function', 'sanitizer fn'),
    ),
  }),
);

/** language tag اصلی (fa-IR ⇒ fa). */
export function languageOf(locale: string): string {
  return locale.split('-')[0] ?? locale;
}

/** region tag (fa-IR ⇒ IR ؛ بدون region ⇒ ''). */
export function regionOf(locale: string): string {
  const parts = locale.split('-');
  return parts.length >= 2 && parts[1]!.length === 2 ? parts[1]! : '';
}

/** خروجی نهایی resolver — همه‌فیلدها معین (به‌جز لودر آپشنال). */
export type ResolvedI18nOptions = Required<Omit<I18nOptions, 'loadMessages' | 'sanitizeHtml'>> & {
  loadMessages?: I18nOptions['loadMessages'];
  sanitizeHtml?: I18nOptions['sanitizeHtml'];
};

/**
 * حل نهایی: پیش‌فرض‌ها + مقادیر وابسته به locale
 * (fa ⇒ calendar:'persian'، numberingSystem:'arabext'؛ region IR ⇒ 'IRR').
 * timeZone پیش‌فرض 'UTC' برای هم‌خوانی SSR/CSR است.
 */
export function resolveI18nOptions(input: I18nOptions = {}): ResolvedI18nOptions {
  const base = { ...I18N_DEFAULTS, ...input } as unknown as ResolvedI18nOptions;
  const lang = languageOf(base.locale);
  if (input.calendar === undefined && lang === 'fa') base.calendar = 'persian';
  if (input.numberingSystem === undefined && lang === 'fa') base.numberingSystem = 'arabext';
  if (input.defaultCurrency === undefined && regionOf(base.locale) === 'IR') {
    base.defaultCurrency = 'IRR';
  }
  return base;
}
