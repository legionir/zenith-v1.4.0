// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDirection,
  detectTextDirection,
  applyDocumentDirection,
  isolateBidi,
  formatLocaleNumber,
  formatCurrency,
  formatRelativeTime,
  formatDateTime,
  formatList,
  resolveHorizontalStep,
  toLogicalCss,
  DEFAULTS,
} from '../src/index';

describe('@zenith/i18n comprehensive RTL, logical direction & bidirectional Intl (#100)', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('detects direction from locale codes, Unicode UAX #9 first-strong character, and applies to documentElement', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(getDirection('fa-IR')).toBe('rtl');
    expect(getDirection('ar-SA')).toBe('rtl');
    expect(getDirection('he')).toBe('rtl');
    expect(getDirection('ckb-IQ')).toBe('rtl');
    expect(getDirection('en-US')).toBe('ltr');
    expect(getDirection('de-DE')).toBe('ltr');

    expect(detectTextDirection('سلام دنیا 123')).toBe('rtl');
    expect(detectTextDirection('Hello سلام')).toBe('ltr');
    expect(detectTextDirection('12345 - !@#')).toBe('auto');

    expect(applyDocumentDirection('fa-IR')).toBe('rtl');
    expect(document.documentElement.lang).toBe('fa-IR');
    expect(document.documentElement.dir).toBe('rtl');

    expect(applyDocumentDirection('en-GB')).toBe('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('formats numbers, currencies (IRT/IRR/USD), relative time, dates, and lists across fa-IR, ar-SA, and en-US', () => {
    const faNum = formatLocaleNumber(1234567.89, 'fa-IR');
    expect(faNum).toContain('۱');
    const enNum = formatLocaleNumber(1234567.89, 'en-US');
    expect(enNum).toBe('1,234,567.89');

    const toman = formatCurrency(250000, 'fa-IR', 'IRT');
    expect(toman).toContain('تومان');
    expect(toman).toContain('۲۵۰');

    const usd = formatCurrency(99.5, 'en-US', 'USD');
    expect(usd).toContain('$99.50');

    const relFa = formatRelativeTime(-3, 'day', 'fa-IR');
    expect(relFa.length).toBeGreaterThan(2);

    const dateFa = formatDateTime(new Date(Date.UTC(2026, 2, 21)), 'fa-IR', { timeZone: 'UTC' });
    expect(dateFa).toContain('۱۴۰۵');

    const listFa = formatList(['علی', 'سارا', 'رضا'], 'fa-IR');
    expect(listFa).toContain('علی');
    expect(listFa).toContain('رضا');
  });

  it('isolates bidirectional tokens with Unicode isolates and converts physical CSS & arrow keys to logical equivalents', () => {
    expect(isolateBidi('+98 912 345 6789', 'ltr')).toBe('\u2066+98 912 345 6789\u2069');
    expect(isolateBidi('کد: ABC-123', 'rtl')).toBe('\u2067کد: ABC-123\u2069');
    expect(isolateBidi('auto-token')).toBe('\u2068auto-token\u2069');

    expect(resolveHorizontalStep('ArrowRight', 'ltr')).toBe(1);
    expect(resolveHorizontalStep('ArrowLeft', 'ltr')).toBe(-1);
    expect(resolveHorizontalStep('ArrowRight', 'rtl')).toBe(-1);
    expect(resolveHorizontalStep('ArrowLeft', 'rtl')).toBe(1);
    expect(resolveHorizontalStep('ArrowUp', 'rtl')).toBe(0);

    const css = '.card { margin-left: 12px; padding-right: 8px; left: 0; text-align: left; }';
    const logical = toLogicalCss(css);
    expect(logical).toContain('margin-inline-start: 12px');
    expect(logical).toContain('padding-inline-end: 8px');
    expect(logical).toContain('inset-inline-start: 0');
    expect(logical).toContain('text-align: start');
  });
});
