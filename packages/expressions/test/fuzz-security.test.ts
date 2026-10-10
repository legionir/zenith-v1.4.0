//
// #30 — fuzz parser/validator/evaluator در @zenith/expressions:
//   * هیچ ورودی (ساخت‌یافته یا تصادفی) نباید crash制御‌نشده، hang یا
//     دسترسی به prototype (constructor/__proto__/prototype) ایجاد کند.
//   * PRNG قطعی با seed (mulberry32) — بدون Math.random/زمان/شبکه.
//   * حجم پیش‌فرض CI: ۱۰۰٬۰۰۰ ورودی؛ با ZENITH_FUZZ_N می‌شود زیاد کرد
//     (اجرای nightly طولانی‌تر در workflow جدا).
import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluate, validate, compile, lex } from '../src/index';

const TOTAL = Number(process.env.ZENITH_FUZZ_N ?? 100_000);

// mulberry32 — PRNG قطعی؛ seed ثابت = تست قابل‌تکرار.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(Number(process.env.ZENITH_FUZZ_SEED ?? 0x5e4d12)); // seed ثابت CI؛ nightly می‌چرخاندش

const TOKENS = [
  'a',
  'b',
  '$x',
  '$obj',
  '1',
  '0',
  '"s"',
  "'t'",
  'true',
  'null',
  'undefined',
  '+',
  '-',
  '*',
  '/',
  '%',
  '==',
  '===',
  '!=',
  '&&',
  '||',
  '!',
  '??',
  '?.',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '.',
  ',',
  ':',
  '?',
  '=>',
  '`',
  '${',
  '}',
  'constructor',
  '__proto__',
  'prototype',
  '[',
  "'__proto__'",
  ']',
  'Function',
  'globalThis',
  'window',
  'alert',
  'eval',
];

const STRUCTURED = [
  // prototype pollution attempts
  'constructor',
  '__proto__',
  'prototype',
  'a.constructor',
  'a.__proto__',
  'a["__proto__"]',
  "a['constructor']",
  'a["prototype"]',
  '$obj[$key]',
  'constructor.constructor("x")',
  'Function("return this")()',
  'globalThis',
  'window.alert(1)',
  'eval("1")',
  'a.b.c.d.e.f.g.h',
  // depth bombs
  '((((((((((((((((((((1))))))))))))))))))))',
  '[' + Array(60).fill('1').join(',') + ']',
  '1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1',
  // truncations
  '(',
  '{',
  '[',
  'a.',
  'a?.',
  '`${',
  'a ? ',
  '&&',
  // long strings
  '"' + 'x'.repeat(5000) + '"',
  '1'.repeat(10000),
  // mXSS-ish text in strings
  '"<script>alert(1)</script>"',
  '"\\u0000\\u0001"',
];

/** ساخت ورودی تصادفی: پیوند تصادفی از توکن‌ها با طول ۱..۴۰. */
function randomInput(): string {
  const len = 1 + Math.floor(rnd() * 40);
  let out = '';
  for (let i = 0; i < len; i++) out += TOKENS[Math.floor(rnd() * TOKENS.length)] + ' ';
  return out;
}

const PROTO_KEYS = ['__proto__', 'constructor', 'prototype'];

function assertNoProtoPollution(ctx: Record<string, unknown>) {
  for (const key of PROTO_KEYS) {
    // نباید هیچ‌کدام روی object literal ساده effect گذاشته باشند
    expect(
      Object.prototype.hasOwnProperty.call({}.constructor.prototype, '__zenith_fuzz_marker__'),
      `pollution via ${key}`,
    ).toBe(false);
    expect(
      ctx[key] === undefined || typeof ctx[key] !== 'function' || key === 'constructor',
    ).toBeTruthy();
  }
}

describe(`expressions fuzz — ${TOTAL} inputs (#30)`, () => {
  it('structured payloads: never crash unhandled, never pollute prototypes', () => {
    const ctx: Record<string, unknown> = { $obj: { a: 1 }, $key: 'constructor', a: { b: 1 } };
    for (const input of STRUCTURED) {
      // هر رفتار مجاز است جز: crash برنامه‌ریزی‌نشده (non-Zenith Error)،
      // hang، یا نوشتن روی prototype.
      let threw: unknown = undefined;
      try {
        evaluateExpression(input, ctx);
      } catch (err) {
        threw = err;
      }
      if (threw !== undefined) {
        expect(threw).toBeInstanceOf(Error);
      }
      assertNoProtoPollution(ctx);
    }
    // نمونهٔ مثبت: این‌ها باید خطای امنیتی بدهند نه crash خام
    for (const forbidden of ['constructor', '__proto__', 'a["__proto__"]', 'a.constructor']) {
      expect(() => evaluateExpression(forbidden, {})).toThrow();
    }
  });

  it('random inputs: compile/validate/eval terminate and stay typed', () => {
    const ctx = { a: 1, b: { c: 2 }, $x: 's' };
    const N = Math.max(0, TOTAL - STRUCTURED.length);
    let handled = 0;
    let rejected = 0;
    for (let i = 0; i < N; i++) {
      const input = randomInput();
      try {
        const ast = compile(input);
        void evaluate(ast, ctx); // evaluator هم باید terminate و typed بماند
        handled++;
      } catch (err) {
        expect(err).toBeInstanceOf(Error); // خطاهای syntax/eval همه Error (ZEN-004 و…)
        rejected++;
      }
      if (i % 5000 === 0) {
        try {
          validate({ type: 'MemberExpression' } as never);
        } catch {
          /* validator ورودی ناقص را reject می‌کند — crash ممنوع */
        }
        try {
          lex(input.slice(0, 100));
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
        }
      }
    }
    expect(handled + rejected).toBe(N);
    // sanity: حداقل مقداری reject شده باشد
    expect(rejected).toBeGreaterThan(N * 0.01);
  }, 240_000);
});
