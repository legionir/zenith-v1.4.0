import { s, validate } from '@zenith/schema';
import { deprecate } from '@zenith/errors';
import { DEFAULTS } from './defaults';
/** Locale and native Intl configuration, without positional configuration. @public */
export interface LocaleFormatOptions<T> { locale?: string; intl?: T; }
/** @public */
export interface CurrencyFormatOptions extends LocaleFormatOptions<Intl.NumberFormatOptions> { currency?: string; }
const intlOptions = s.custom(value => value !== null && typeof value === 'object' && !Array.isArray(value), 'Intl options object');
const localeSchema = s.object({ locale: s.optional(s.string({ min: 1 })), intl: s.optional(intlOptions) });
const currencySchema = s.object({ locale: s.optional(s.string({ min: 1 })), intl: s.optional(intlOptions), currency: s.optional(s.string({ min: 1 })) });
function resolve<T>(options: LocaleFormatOptions<T> | string | undefined, legacy: T | undefined, name: string, code: string): { locale: string; intl: T | undefined } {
  if (options !== undefined && typeof options !== 'string') options = validate(localeSchema, options, { name: 'LocaleFormatOptions', mode: 'throw', strict: true, coerce: false }) as unknown as LocaleFormatOptions<T>;
  if (typeof options === 'string' || legacy !== undefined) deprecate(code, `${name}(value, locale, options)`, `${name}(value, { locale, intl })`);
  return { locale: typeof options === 'string' ? options : options?.locale ?? DEFAULTS.locale, intl: typeof options === 'string' || options === undefined ? legacy : options.intl ?? legacy };
}
/** Format a number with explicit locale/Intl options. @public */
export function formatLocaleNumber(value: number, options?: LocaleFormatOptions<Intl.NumberFormatOptions>): string;
/** @public @deprecated Use formatLocaleNumber(value, { locale, intl }). */
export function formatLocaleNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions): string;
export function formatLocaleNumber(value: number, options?: LocaleFormatOptions<Intl.NumberFormatOptions> | string, legacy?: Intl.NumberFormatOptions): string {
  const config = resolve(options, legacy, 'formatLocaleNumber', 'ZEN-DEPR-074'); return new Intl.NumberFormat(config.locale, config.intl).format(value);
}
/** Native currency formatting with the legacy IRT/toman convention. @public */
export function formatCurrency(value: number, options?: CurrencyFormatOptions): string;
/** @public @deprecated Use formatCurrency(value, { locale, currency, intl }). */
export function formatCurrency(value: number, locale?: string, currency?: string, options?: Intl.NumberFormatOptions): string;
export function formatCurrency(value: number, options?: CurrencyFormatOptions | string, legacyCurrency?: string, legacyIntl?: Intl.NumberFormatOptions): string {
  if (options !== undefined && typeof options !== 'string') options = validate(currencySchema, options, { name: 'CurrencyFormatOptions', mode: 'throw', strict: true, coerce: false }) as unknown as CurrencyFormatOptions;
  const legacy = typeof options === 'string' || legacyCurrency !== undefined || legacyIntl !== undefined;
  if (legacy) deprecate('ZEN-DEPR-075', 'formatCurrency(value, locale, currency, options)', 'formatCurrency(value, { locale, currency, intl })');
  const locale = typeof options === 'string' ? options : options?.locale ?? DEFAULTS.locale;
  const currency = legacy ? legacyCurrency ?? DEFAULTS.currency : (typeof options === 'object' ? options.currency : undefined) ?? DEFAULTS.currency;
  const intl = legacy ? legacyIntl : typeof options === 'object' ? options.intl : undefined;
  if (currency.toUpperCase() === 'IRT') {
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, ...intl }).format(value);
    return locale.toLowerCase().startsWith('fa') ? `${formatted} تومان` : `${formatted} IRT`;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...intl }).format(value);
}
/** @public */
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: LocaleFormatOptions<Intl.RelativeTimeFormatOptions>): string;
/** @public @deprecated Use formatRelativeTime(value, unit, { locale, intl }). */
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale?: string, options?: Intl.RelativeTimeFormatOptions): string;
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: LocaleFormatOptions<Intl.RelativeTimeFormatOptions> | string, legacy?: Intl.RelativeTimeFormatOptions): string {
  const config = resolve(options, legacy, 'formatRelativeTime', 'ZEN-DEPR-076'); return new Intl.RelativeTimeFormat(config.locale, config.intl ?? { numeric: 'auto' }).format(value, unit);
}
/** @public */
export function formatDateTime(value: Date | number, options?: LocaleFormatOptions<Intl.DateTimeFormatOptions>): string;
/** @public @deprecated Use formatDateTime(value, { locale, intl }). */
export function formatDateTime(value: Date | number, locale?: string, options?: Intl.DateTimeFormatOptions): string;
export function formatDateTime(value: Date | number, options?: LocaleFormatOptions<Intl.DateTimeFormatOptions> | string, legacy?: Intl.DateTimeFormatOptions): string {
  const config = resolve(options, legacy, 'formatDateTime', 'ZEN-DEPR-077'); return new Intl.DateTimeFormat(config.locale, config.intl).format(value);
}
/** @public */
export function formatList(value: readonly string[], options?: LocaleFormatOptions<Intl.ListFormatOptions>): string;
/** @public @deprecated Use formatList(value, { locale, intl }). */
export function formatList(value: readonly string[], locale?: string, options?: Intl.ListFormatOptions): string;
export function formatList(value: readonly string[], options?: LocaleFormatOptions<Intl.ListFormatOptions> | string, legacy?: Intl.ListFormatOptions): string {
  const config = resolve(options, legacy, 'formatList', 'ZEN-DEPR-078'); return new Intl.ListFormat(config.locale, config.intl).format(value);
}
