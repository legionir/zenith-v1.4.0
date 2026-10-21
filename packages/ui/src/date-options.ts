import { defineOptions, s, validate, parseConfigAttr, type DirectiveMeta } from '@zenith/schema';
import type { MaybeReactive } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { validDateFormat, type Calendar } from './date-calendar';
/** Concrete calendar configuration; firstDay uses JS weekdays (Sunday=0). @public */
export interface DatePickerConfig {
  calendar?: Calendar; locale?: string; value?: string; min?: string; max?: string; firstDay?: number; format?: string;
  disabled?: boolean; readOnly?: boolean; required?: boolean; name?: string; range?: boolean; disabledDates?: readonly string[]; nonce?: string;
}
/** All programmatic date-picker values may be readable signals. @public */
export type DatePickerOptions = { [K in keyof DatePickerConfig]?: MaybeReactive<NonNullable<DatePickerConfig[K]>> };
const dates = s.array(s.string());
const schema = s.object({
  calendar: s.default(s.enum(['jalali', 'gregorian']), 'jalali'),
  locale: s.optional(s.custom<string>(value => { if (typeof value !== 'string' || !value) return false; try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; } }, 'BCP-47 locale')),
  value: s.default(s.string(), ''), min: s.default(s.string(), ''), max: s.default(s.string(), ''),
  firstDay: s.optional(s.number({ int: true, min: 0, max: 6 })), format: s.default(s.custom<string>(value => typeof value === 'string' && validDateFormat(value), 'YYYY/MM/DD tokens separated by /, - or .'), 'YYYY/MM/DD'),
  disabled: s.default(s.boolean(), false), readOnly: s.default(s.boolean(), false), required: s.default(s.boolean(), false),
  name: s.default(s.string(), ''), range: s.default(s.boolean(), false),
  disabledDates: s.default(s.custom<readonly string[]>(value => Array.isArray(value) && value.length <= 4096 && value.every(item => typeof item === 'string'), 'up to 4096 date strings'), []),
  nonce: s.optional(s.string()),
});
const base = /* @__PURE__ */ defineOptions<DatePickerConfig>('DatePickerOptions', schema);
/** Strict schema validation is independent of development logging mode. @public */
export const datePickerOptions = { ...base, resolve(input: unknown): DatePickerConfig { return Object.freeze(validate<DatePickerConfig>(schema, input, { name: 'DatePickerOptions', mode: 'throw', coerce: true })); } };
export function readDateOptions(el: HTMLElement): DatePickerConfig {
  // HTML boolean attributes use presence (including disabled="false").
  const bool = (name: string) => el.hasAttribute(name) ? true : undefined;
  const raw = el.getAttribute('disabled-dates');
  if (raw && raw.length > 262144) throw createReservedError('ZEN-1001');
  const excluded = raw?.trim() ? parseConfigAttr(el, 'disabled-dates', dates) : [];
  if (excluded.length > 4096) throw createReservedError('ZEN-1001');
  return datePickerOptions.resolve({
    calendar: el.getAttribute('calendar') ?? undefined, locale: el.getAttribute('locale') ?? undefined,
    value: el.getAttribute('value') ?? '', min: el.getAttribute('min') ?? '', max: el.getAttribute('max') ?? '',
    firstDay: el.getAttribute('first-day') ?? undefined, format: el.getAttribute('format') ?? undefined,
    disabled: bool('disabled'), readOnly: bool('readonly'), required: bool('required'), name: el.getAttribute('name') ?? '', range: bool('range'), disabledDates: excluded, nonce: el.nonce || el.getAttribute('nonce') || undefined,
  });
}

/** @internal Shared registration/metadata source for the custom-element directive. */
export const DATE_PICKER_META: DirectiveMeta = {
  name: 'zen-date-picker', description: 'Owner-realm Jalali/Gregorian calendar with bounded selection, range and form validation.',
  syntax: '<zen-date-picker calendar="gregorian" value="2024-02-29" format="YYYY-MM-DD" name="date"></zen-date-picker>',
  attributes: ['value', 'calendar', 'locale', 'min', 'max', 'first-day', 'format', 'disabled', 'readonly', 'required', 'name', 'form', 'range', 'disabled-dates', 'nonce'],
};
