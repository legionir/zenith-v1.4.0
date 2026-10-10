// @vitest-environment node
//
// #171 — بازه‌های کد خطا در catalog @zenith/errors (مصوب DEC-020):
//  - کدهای موجود ۳رقمی هرگز renumber نمی‌شوند و در الگوی جدید می‌گنجند.
//  - بازه‌های ۴رقمی SPEC (§۰.۴) + کدهای مشخص‌شده بدنهٔ issue در catalog با
//    message فارسی، suggestion و docsUrl.
//  - فضای ZEN-DEPR-xxx (DEC-019) ثبت شده: ۰۰۱..۰۰۴.
//  - یکتایی کدها و عدم تداخل بازه‌ها خودکار تضمین می‌شود.
//  - هیچ مصرف‌کننده‌ای (devtools/cli/vscode) regex سه‌رقمی-محور ندارد که
//    با کد ۴رقمی بشکند.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ErrorCode,
  ERROR_CODE_PATTERN,
  ERROR_CODE_RANGES,
  RESERVED_ERROR_CODES,
  DEPRECATION_CODES,
  errorDocsUrl,
  createReservedError,
} from '../src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// کدهای مشخص‌شده در بدنهٔ issue #171 (منبع: NEW-PACKAGES-SPEC §۰.۴ و بندهای پکیج‌ها)
const REQUIRED_CODES = [
  'ZEN-1001',
  'ZEN-1002',
  'ZEN-1003',
  'ZEN-1004',
  'ZEN-1090',
  'ZEN-1091',
  'ZEN-1101',
  'ZEN-1102',
  'ZEN-1103',
  'ZEN-1104',
  'ZEN-1201',
  'ZEN-1202',
  'ZEN-1301',
  'ZEN-1302',
  'ZEN-1303',
  'ZEN-1311',
  'ZEN-1312',
  'ZEN-1313',
  'ZEN-1314',
  'ZEN-1401',
  'ZEN-1402',
  'ZEN-1403',
  'ZEN-1501',
  'ZEN-1502',
  'ZEN-1503',
  'ZEN-1601',
  'ZEN-1602',
  'ZEN-1603',
  'ZEN-1604',
  'ZEN-1701',
  'ZEN-1702',
  'ZEN-1703',
  'ZEN-1704',
  'ZEN-1705',
  'ZEN-1801',
  'ZEN-1802',
  'ZEN-1803',
  'ZEN-1811',
  'ZEN-1812',
  'ZEN-1821',
  'ZEN-1822',
  'ZEN-1901',
  'ZEN-1902',
  'ZEN-2001',
  'ZEN-2002',
  'ZEN-2101',
  'ZEN-2102',
  'ZEN-2103',
  'ZEN-2104',
  'ZEN-2105',
  'ZEN-2201',
  'ZEN-2202',
  'ZEN-2301',
  'ZEN-2302',
  'ZEN-2303',
  'ZEN-2310',
  'ZEN-2320',
  'ZEN-2401',
  'ZEN-2402',
  'ZEN-2501',
  'ZEN-2510',
  'ZEN-2520',
  'ZEN-2521',
  'ZEN-2530',
  'ZEN-2531',
];

describe('error-code pattern (#171, DEC-020)', () => {
  it('accepts 3-digit legacy, 4-digit new and ZEN-DEPR codes', () => {
    expect(ERROR_CODE_PATTERN.test('ZEN-004')).toBe(true);
    expect(ERROR_CODE_PATTERN.test('ZEN-999')).toBe(true);
    expect(ERROR_CODE_PATTERN.test('ZEN-1001')).toBe(true);
    expect(ERROR_CODE_PATTERN.test('ZEN-DEPR-001')).toBe(true);
    expect(ERROR_CODE_PATTERN.test('ZEN-10001')).toBe(false); // ۵ رقم رد
    expect(ERROR_CODE_PATTERN.test('ZEN-DEPR-1')).toBe(false);
    expect(ERROR_CODE_PATTERN.test('zen-001')).toBe(false);
    expect(ERROR_CODE_PATTERN.test('ZEN-01')).toBe(false);
  });

  it('every existing 3-digit ErrorCode value matches the pattern (no renumbering)', () => {
    for (const [name, value] of Object.entries(ErrorCode)) {
      expect(ERROR_CODE_PATTERN.test(value), `${name}=${value}`).toBe(true);
      expect(value).toMatch(/^ZEN-\d{3}$/); // کدهای موجود همان سه‌رقمی می‌مانند
    }
  });
});

describe('4-digit ranges table (#171)', () => {
  it('declares all 16 SPEC ranges with distinct domains', () => {
    const starts = ERROR_CODE_RANGES.map((r) => r.from);
    expect(new Set(starts).size).toBe(16);
    for (const expected of [
      1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400,
      2500,
    ]) {
      expect(starts).toContain(expected);
    }
    // هر بازه ۱۰۰تایی و بدون هم‌پوشانی
    for (const r of ERROR_CODE_RANGES) {
      expect(r.to - r.from).toBe(99);
    }
    const domains = ERROR_CODE_RANGES.map((r) => r.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('ranges do not collide with legacy 3-digit space', () => {
    for (const r of ERROR_CODE_RANGES) {
      expect(r.from).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('reserved 4-digit catalog (#171)', () => {
  it.each(REQUIRED_CODES)('%s exists with message, suggestion and docsUrl', (code) => {
    const entry = RESERVED_ERROR_CODES[code];
    expect(entry, `catalog entry for ${code}`).toBeDefined();
    expect(entry.message.length).toBeGreaterThan(0);
    expect(entry.suggestion.length).toBeGreaterThan(0);
    expect(errorDocsUrl(code)).toBe(`https://zenith.dev/errors/${code}`);
    expect(entry.category.length).toBeGreaterThan(0);
  });

  it('every catalog code is unique and inside its declared range/domain', () => {
    const codes = Object.keys(RESERVED_ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^ZEN-1\d{3}|^ZEN-2[0-5]\d{2}$/);
      const num = parseInt(code.slice(4), 10);
      const range = ERROR_CODE_RANGES.find((r) => num >= r.from && num <= r.to);
      expect(range, `range for ${code}`).toBeDefined();
      expect(RESERVED_ERROR_CODES[code].domain).toBe(range!.domain);
    }
  });

  it('catalog has no overlap with existing ErrorCode values', () => {
    const legacy = new Set(Object.values(ErrorCode));
    for (const code of Object.keys(RESERVED_ERROR_CODES)) {
      expect(legacy.has(code), `${code} duplicated`).toBe(false);
    }
  });

  it('createReservedError builds a ZenithError carrying code/message/suggestion/docsUrl', () => {
    const err = createReservedError('ZEN-1001', { details: { path: 'a.b' } });
    expect(err.name).toBe('ZenithError');
    expect(err.code).toBe('ZEN-1001');
    expect(err.suggestion).toBe(RESERVED_ERROR_CODES['ZEN-1001'].suggestion);
    expect(err.docsUrl).toBe('https://zenith.dev/errors/ZEN-1001');
    expect(err.toUserString()).toContain('zenith.dev/errors/ZEN-1001');
    expect(err.toJSON().docsUrl).toBe('https://zenith.dev/errors/ZEN-1001');
    expect(() => createReservedError('ZEN-004' as never)).toThrow();
    expect(() => createReservedError('ZEN-9999' as never)).toThrow();
  });
});

describe('ZEN-DEPR registry (#171 formalizes DEC-019)', () => {
  it('contains exactly the five issued codes with api/replacement', () => {
    expect(Object.keys(DEPRECATION_CODES).sort()).toEqual([
      'ZEN-DEPR-001',
      'ZEN-DEPR-002',
      'ZEN-DEPR-003',
      'ZEN-DEPR-004',
      'ZEN-DEPR-005',
    ]);
    expect(DEPRECATION_CODES['ZEN-DEPR-001'].api).toBe('processVirtualList');
    expect(DEPRECATION_CODES['ZEN-DEPR-002'].api).toBe('enterTransition');
    expect(DEPRECATION_CODES['ZEN-DEPR-003'].api).toBe('leaveTransition');
    expect(DEPRECATION_CODES['ZEN-DEPR-004'].api).toBe('animateGroup');
    expect(DEPRECATION_CODES['ZEN-DEPR-005'].api).toBe('clearCache (http)'); // #144
    for (const meta of Object.values(DEPRECATION_CODES)) {
      expect(meta.removedIn).toBe('2.0.0'); // DEC-026
    }
  });
});

describe('consumer regex safety (#171 acceptance)', () => {
  const consumers = ['devtools/src', 'cli/src', 'vscode-extension/src'];
  it('no consumer source pins a 3-digit-only ZEN regex', () => {
    for (const rel of consumers) {
      const dir = join(ROOT, 'packages', rel);
      const files = [];
      const walk = (d: string) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.(ts|js|mjs|cjs)$/.test(e.name)) files.push(p);
        }
      };
      walk(dir);
      for (const f of files) {
        const text = readFileSync(f, 'utf8');
        // regex‌هایی که دقیقاً ۳ رقم می‌خواهند (مثل ZEN-\d{3} بدون lookahead یا [0-9]{3} کنار ZEN-)
        const bad =
          text.match(/ZEN-\\?d\{3\}(?!\+)($|[^+{])/g) || text.match(/ZEN-\[[0-9]-\]\{3\}(?!\+)/g);
        expect(bad, `3-digit-only regex in ${f}`).toBeNull();
      }
    }
  });
});
