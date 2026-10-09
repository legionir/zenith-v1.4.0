// packages/expressions/test/parser-eof.test.ts
//
// #10 — جلوگیری از null-deref / TypeError روی ورودی ناقص (EOF) و خطاهای
// ZenithError با کد ZEN-004 و موقعیت به‌جای `Error` خام با پیام «null».

import { describe, it, expect } from 'vitest';
import { compile } from '../src/index';

/** ورودی‌های ناقص که باید همه ZenithError ZEN-004 با موقعیت بدهند */
const TRUNCATED_INPUTS = [
  '(',
  '(a,',
  '[1,',
  '{a:',
  'a?.',
  'a[',
  'a.',
  'a ? b',
  'x[1',
  'f(',
  '{',
  '[',
  '{a',
  'a??',
  '(a ? b',
  '((',
  '((a',
  'a(',
  'a +',
  'a * ',
  '! ',
  '- ',
  'a && ',
  'a || ',
  'a > ',
  'a=>',
  '`${a',
  '`${a}',
  '`',
  'a instanceof',
  '{a:1',
  '{a:1,',
];

function expectZenithSyntaxError(src: string): void {
  let caught: unknown;
  try {
    compile(src);
  } catch (e) {
    caught = e;
  }
  expect(caught, `expected throw for input ${JSON.stringify(src)}`).toBeInstanceOf(Error);
  const err = caught as Error & { code?: string; name?: string; details?: Record<string, unknown> };
  expect(err).not.toBeInstanceOf(TypeError);
  expect(err.name).toBe('ZenithError');
  expect(err.code).toBe('ZEN-004');
  expect(
    err.message,
    `message must not leak raw 'null' token for ${JSON.stringify(src)}`,
  ).not.toMatch(/'null'/);
  expect(typeof err.details?.['position']).toBe('number');
}

describe('parser: truncated input (#10)', () => {
  it.each(TRUNCATED_INPUTS)('truncated %s → ZenithError ZEN-004 with position', (src) => {
    expectZenithSyntaxError(src);
  });

  it('never throws TypeError on truncated EOF', () => {
    for (const src of TRUNCATED_INPUTS) {
      try {
        compile(src);
      } catch (e) {
        expect(e).not.toBeInstanceOf(TypeError);
        expect(e).not.toBeInstanceOf(ReferenceError);
      }
    }
  });

  it('rejects trailing junk after a complete expression', () => {
    for (const src of ['a)', '(a))', '1 2', 'a b', '[1] x']) {
      expect(() => compile(src), src).toThrow();
      try {
        compile(src);
      } catch (e) {
        const err = e as { name?: string; code?: string };
        expect(err.name, src).toBe('ZenithError');
        expect(err.code, src).toBe('ZEN-004');
      }
    }
  });
});

describe('parser: fuzz truncated/random inputs (#10)', () => {
  it('10,000 random truncated inputs never produce TypeError/ReferenceError', () => {
    // RNG قطعی (mulberry32) تا تست reproducible باشد
    let seed = 0x5eed10;
    const rnd = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const alphabet = [
      'a',
      'b',
      '$x',
      '1',
      '2.5',
      '"s"',
      "'t'",
      'true',
      'null',
      '(',
      ')',
      '[',
      ']',
      '{',
      '}',
      ',',
      '.',
      '?.',
      '...',
      '[',
      ']',
      '+',
      '-',
      '*',
      '/',
      '%',
      '!',
      '?',
      ':',
      '=>',
      '&&',
      '||',
      '??',
      '==',
      '===',
      '!=',
      '<',
      '>',
      '<=',
      '>=',
      '**',
      '`',
      '${',
      '}',
      'typeof',
      'new',
      'in',
      'instanceof',
      ' ',
      ' ',
      '\n',
      '@',
      '#',
      '\\',
    ];

    let okCount = 0;
    let errCount = 0;
    for (let i = 0; i < 10_000; i++) {
      const len = 1 + Math.floor(rnd() * 12);
      let src = '';
      for (let j = 0; j < len; j++) src += alphabet[Math.floor(rnd() * alphabet.length)];
      try {
        compile(src);
        okCount++;
      } catch (e) {
        errCount++;
        // هیچ crash غیرقابل‌انتظاری مجاز نیست: فقط ZenithError (syntax/security)
        const err = e as Error & { name?: string; code?: string };
        if (
          err instanceof TypeError ||
          err instanceof ReferenceError ||
          err instanceof RangeError
        ) {
          throw new Error(
            `fuzz crash on ${JSON.stringify(src)}: ${err.constructor.name}: ${err.message}`,
          );
        }
        expect(err.name, `input ${JSON.stringify(src)}`).toBe('ZenithError');
        expect(typeof err.code, `input ${JSON.stringify(src)}`).toBe('string');
      }
    }
    // sanity: فیوژ باید هم خطا و (کم‌تعداد) موفق داشته باشد
    expect(errCount).toBeGreaterThan(100);
    expect(okCount + errCount).toBe(10_000);
  });
});
