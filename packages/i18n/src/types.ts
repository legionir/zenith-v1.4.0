// packages/i18n/src/types.ts — تایپ‌های عمومی @zenith/i18n (#150, SPEC NEW-PKG §۳.۱).
//
// چندزبانگی واقعی: پیام‌ها، ICU-subset، plural، قالب عدد/تاریخ (Intl)،
// locale واکنشی. ابزار جلالی به @zenith/jalali سپرده شده (aliasهای قدیمی با
// deprecate در همان barrel index.ts باقی‌اند).

import type { Disposable, Cleanup } from '@zenith/shared';

/**
 * شکل عمومی سیگنال i18n — ساختاری با @zenith/state سازگار (get/peek/set)
 * و با `subscribe(fn)` برای نمایش پایدار تغییر locale/dir بدون وابستگی اجباری
 * به effect-tracking (معیار spec: «تغییر locale واکنشی بدون rerender کامل»).
 */
export interface I18nReadonlySignal<T> {
  get(): T;
  peek(): T;
  subscribe(fn: (value: T) => void): Cleanup;
}

/** نسخهٔ writable (locale). */
export interface I18nSignal<T> extends I18nReadonlySignal<T> {
  set(value: T): void;
}

/** درختی از پیام‌ها: هر برگ رشتهٔ قالب (ICU-subset) است. */
export type Messages = {
  readonly [key: string]: string | Messages;
};

/** پارامترهای قالب: رشته/عدد/تاریخ برای جایگذاری در placeholderها. */
export type I18nParams = {
  readonly [key: string]: string | number | boolean | Date | null | undefined;
};

/** سیاست مدیریت کلید ناموجود. */
export type MissingStrategy = 'key' | 'empty' | 'throw';

/** منبع تشخیص locale. */
export type DetectSource = 'query' | 'cookie' | 'storage' | 'navigator' | 'path';

/** نام تقویم. fa ⇒ 'persian' به‌صورت خودکار مگر خلافش گفته شود. */
export type CalendarName = 'gregory' | 'persian';

/** سیستم ارقام: latn (لاتین)، arab (۱۲۳ عربی-هندی)، arabext (۱۲۳ فارسی). */
export type NumberingSystem = 'latn' | 'arab' | 'arabext';

/** گزینه‌های ایجاد i18n (SPEC §۳.۱، جدول گزینه‌ها). */
export interface I18nOptions {
  /** locale آغازین. پیش‌فرض 'en'. */
  locale?: string;
  /** زنجیرهٔ fallback (یک locale یا فهرستشان). پیش‌فرض 'en'. */
  fallbackLocale?: string | readonly string[];
  /** پیام‌های اولیه: locale → Messages. */
  messages?: Record<string, Messages>;
  /** بارگذار تنبل پیام‌ها برای locale خاموش/ناشناخته (برای setLocale). */
  loadMessages?: (locale: string) => Promise<Messages>;
  /** ترتیب تشخیص locale از منابع. پیش‌فرض []. */
  detect?: readonly DetectSource[];
  /** کلید نام در query/cookie. پیش‌فرض 'lang'. */
  detectKey?: string;
  /** کلید ذخیره در storage؛ `false` برای غیرفعال. پیش‌فرض 'zen.locale'. */
  persist?: string | false;
  /** سیاست کلید ناموجود. پیش‌فرض 'key'. */
  missing?: MissingStrategy;
  /** هشدار در dev هنگام کلید ناموجود (logger). پیش‌فرض true در dev. */
  warnOnMissing?: boolean;
  /** قالب‌های عددی نام‌دار برای n(fmt) و `{x, number, fmt}`. */
  numberFormats?: Record<string, Intl.NumberFormatOptions>;
  /** قالب‌های تاریخی نام‌دار برای d(fmt) و `{x, date, fmt}`. */
  dateFormats?: Record<string, Intl.DateTimeFormatOptions>;
  /** تقویم؛ پیش‌فرض بر اساس locale (fa ⇒ persian). */
  calendar?: CalendarName;
  /** سیستم ارقام؛ پیش‌فرض بر اساس locale (fa ⇒ arabext، در غیر این صورت latn). */
  numberingSystem?: NumberingSystem;
  /** منطقهٔ زمانی؛ در SSR پیش‌فرض 'UTC' برای هم‌خوانی سرور/کلاینت. */
  timeZone?: string;
  /** escape HTML در پارامترهای رشته‌ای. پیش‌فرض true. */
  escapeParams?: boolean;
  /** همگام‌سازی lang/dir روی <html>. پیش‌فرض true. */
  syncDocument?: boolean;
  /** localeهای راست‌به‌چپ. پیش‌فرض ['fa','ar','he','ur']. */
  rtlLocales?: readonly string[];
  /**
   * ارز پیش‌فرض برای `{x, number, currency}` هنگامی که numberFormats['currency']
   * تعریف نشده باشد (افزونهٔ Zenith نسبت به جدول spec — fa ⇒ 'IRR').
   */
  defaultCurrency?: string;
}

/** کانتکست درخواست SSR برای detectLocale (اختیاری). */
export interface DetectContext {
  query?: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  pathname?: string;
  headers?: Record<string, string | undefined>;
}

/** گزینه‌های per-call برای t(). */
export interface TCallOptions {
  /** locale مستقیم برای این فراخوان (بدون setLocale سراسری). */
  locale?: string;
  /** متن پیش‌فرض اگر کلید پیدا نشد. */
  default?: string;
  /** عدد برای plural؛ معادل params.count. */
  count?: number;
}

/** API عمومی i18n (SPEC §۳.۱). */
export interface I18n extends Disposable {
  /** locale جاری (Signal: خواندنی/نوشتنی + subscribe). */
  readonly locale: I18nSignal<string>;
  /** جهت فعلی بر اساس rtlLocales (فقط‌خواندنی + subscribe). */
  readonly dir: I18nReadonlySignal<'rtl' | 'ltr'>;
  /** فهرست localeهای موجود (پیام‌شان بارگذاری شده یا در messages اولیه است). */
  readonly availableLocales: I18nReadonlySignal<readonly string[]>;
  /** ترجمهٔ کلید با پارامتر؛ مسیر کامل fallback + ICU-subset اعمال می‌شود. */
  t(key: string, params?: I18nParams, o?: TCallOptions): string;
  /** آیا کلید در locale جاری (یا fallbackها) وجود دارد؟ */
  te(key: string, locale?: string): boolean;
  /** پیام خام (قالب) کلید پس از حل fallback و لینک‌های @: — بدون فرمت. */
  tm(key: string, locale?: string): string | undefined;
  /** قالب‌بندی عدد بر اساس locale/calendar/numberingSystem جاری. */
  n(value: number, fmt?: string | Intl.NumberFormatOptions): string;
  /** قالب‌بندی تاریخ/زمان. */
  d(date: Date | number, fmt?: string | Intl.DateTimeFormatOptions): string;
  /** زمان نسبی (مثلاً «۳ روز پیش»). */
  rt(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  /** فهرست‌بندی (…، … و …). */
  list(items: readonly string[], o?: Intl.ListFormatOptions): string;
  /** تعویض locale واکنشی؛ با loadMessages در صورت نیاز lazy است (Promise). */
  setLocale(locale: string): Promise<void>;
  /** افزودن پیام‌ها (ادغام پیش‌فرض؛ با o.merge=false جایگزینی کامل locale). */
  addMessages(locale: string, messages: Messages, o?: { merge?: boolean }): Cleanup;
  /** تغییر تهاجمی locale بدون await کردن بارگذاری (وقتی پیام‌ها از قبل هست). */
  detectLocale(ctx?: DetectContext): string | undefined;
}

export type { Disposable, Cleanup };
