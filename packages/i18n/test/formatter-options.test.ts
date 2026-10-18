import { expect, it } from 'vitest';
import { formatLocaleNumber, formatCurrency, formatDateTime, formatList, formatRelativeTime } from '../src';
it('matches Intl and every retained locale/options signature', () => {
  const number = { maximumFractionDigits: 1 };
  expect(formatLocaleNumber(1234.56, { locale: 'en-US', intl: number })).toBe(formatLocaleNumber(1234.56, 'en-US', number));
  const intl = { timeZone: 'UTC' };
  expect(formatDateTime(0, { locale: 'en-US', intl })).toBe(formatDateTime(0, 'en-US', intl));
  expect(formatCurrency(12, { locale: 'en-US', currency: 'USD' })).toBe(formatCurrency(12, 'en-US', 'USD'));
  expect(formatList(['a', 'b'], { locale: 'en-US' })).toBe(formatList(['a', 'b'], 'en-US'));
  expect(formatRelativeTime(-1, 'day', { locale: 'en-US' })).toBe(formatRelativeTime(-1, 'day', 'en-US'));
});
it('preserves toman formatting and optional legacy locale holes', () => {
  expect(formatCurrency(12, { locale: 'fa-IR', currency: 'IRT' })).toBe(formatCurrency(12, 'fa-IR', 'IRT'));
  expect(formatCurrency(12, { currency: 'USD' })).toBe(formatCurrency(12, undefined, 'USD'));
  expect(formatLocaleNumber(1.25, { intl: { maximumFractionDigits: 0 } })).toBe(formatLocaleNumber(1.25, undefined, { maximumFractionDigits: 0 }));
});
it('validates canonical wrapper keys while preserving native Intl errors', () => {
  expect(() => formatLocaleNumber(1, { locale: 1 } as never)).toThrow();
  expect(() => formatCurrency(1, { currency: 'USD', extra: true } as never)).toThrow();
  expect(() => formatDateTime(0, { intl: { timeZone: 'invalid/timezone' } })).toThrow(RangeError);
});
