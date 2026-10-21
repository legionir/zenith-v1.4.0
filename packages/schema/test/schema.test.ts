// #142 — هستۀ اعتبارسنجی schema (SPEC §۲.۲): s builder، validate/safeValidate،
// defineOptions، parseConfigAttr، گزینه‌های ValidateOptions و کدهای
// ZEN-1001/1002/1003/1004 (کاتالوگ #171).
import { describe, it, expect } from 'vitest';
import {
  s,
  validate,
  safeValidate,
  defineOptions,
  parseConfigAttr,
  setSchemaWarnReporter,
} from '../src/index';

function errOf(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected throw');
}

describe('s.* primitive kinds', () => {
  it('string: accepts, rejects wrong type ⇒ ZEN-1001 با مسیر', () => {
    expect(validate(s.string(), 'hi')).toBe('hi');
    const e = errOf(() => validate(s.string(), 5));
    expect(e.code).toBe('ZEN-1001');
    expect(e.details.issues[0].path).toEqual([]);
    expect(e.details.issues[0].expected).toBe('string');
  });

  it('string min/max طول ⇒ خارج از بازه ZEN-1004', () => {
    const sch = s.string({ min: 2, max: 4 });
    expect(validate(sch, 'abc')).toBe('abc');
    expect(errOf(() => validate(sch, 'a')).code).toBe('ZEN-1004');
    expect(errOf(() => validate(sch, 'abcde')).code).toBe('ZEN-1004');
  });

  it('string pattern ⇒ ZEN-1001', () => {
    expect(validate(s.string({ pattern: '^a+$' }), 'aaa')).toBe('aaa');
    expect(errOf(() => validate(s.string({ pattern: '^a+$' }), 'b')).code).toBe('ZEN-1001');
  });

  it('number: min/max/int و پیام مسیر', () => {
    expect(validate(s.number(), 3.5)).toBe(3.5);
    expect(errOf(() => validate(s.number(), '3')).code).toBe('ZEN-1001');
    expect(errOf(() => validate(s.number({ min: 1, max: 10 }), 11)).code).toBe('ZEN-1004');
    expect(errOf(() => validate(s.number({ int: true }), 1.5)).code).toBe('ZEN-1001');
    const e = errOf(() => validate(s.object({ n: s.number() }), { n: 'x' }));
    expect(e.details.issues[0].path).toEqual(['n']);
  });

  it('boolean', () => {
    expect(validate(s.boolean(), true)).toBe(true);
    expect(errOf(() => validate(s.boolean(), 'true')).code).toBe('ZEN-1001');
  });

  it('enum', () => {
    const sch = s.enum(['a', 'b', 3] as const);
    expect(validate(sch, 'b')).toBe('b');
    expect(validate(sch, 3)).toBe(3);
    const e = errOf(() => validate(sch, 'z'));
    expect(e.code).toBe('ZEN-1001');
    expect(e.details.issues[0].expected).toContain('enum');
  });

  it('duration: عدد ms یا رشتهٔ واحددار؛ منفی ⇒ ZEN-1004', () => {
    expect(validate(s.duration(), 500)).toBe(500);
    expect(validate(s.duration(), '30s', { coerce: true })).toBe(30000);
    expect(validate(s.duration(), '5m', { coerce: true })).toBe(300000);
    expect(errOf(() => validate(s.duration(), 'abc')).code).toBe('ZEN-1001');
    expect(errOf(() => validate(s.duration(), -1)).code).toBe('ZEN-1004');
  });

  it('fn/signal/element با duck-type بدون DOM', () => {
    expect(validate(s.fn(), () => 1)).toBeTypeOf('function');
    const sig = { get: () => 1, set: () => {} };
    expect(validate(s.signal(), sig)).toBe(sig);
    const el = { nodeType: 1, getAttribute: () => null };
    expect(validate(s.element(), el)).toBe(el);
    expect(errOf(() => validate(s.fn(), 1)).code).toBe('ZEN-1001');
  });
});

describe('object / array / record / union / optional / default / custom', () => {
  it('object: مسیر nested در issues و مقدار معتبر پاس‌می‌شود', () => {
    const sch = s.object({ a: s.number(), b: s.object({ c: s.string() }) });
    expect(validate(sch, { a: 1, b: { c: 'x' } })).toEqual({ a: 1, b: { c: 'x' } });
    const e = errOf(() => validate(sch, { a: 1, b: { c: 2 } }));
    expect(e.details.issues[0].path).toEqual(['b', 'c']);
  });

  it('strict: کلید ناشناخته ⇒ ZEN-1002 (پیش‌فرض dev strict=true)', () => {
    const sch = s.object({ a: s.number() });
    expect(errOf(() => validate(sch, { a: 1, zz: 2 })).code).toBe('ZEN-1002');
    // strict:false ⇒ نادیده گرفته می‌شود
    expect(validate(sch, { a: 1, zz: 2 }, { strict: false })).toEqual({ a: 1 });
  });

  it('array/record', () => {
    expect(validate(s.array(s.number()), [1, 2])).toEqual([1, 2]);
    expect(errOf(() => validate(s.array(s.number()), [1, 'a'])).details.issues[0].path).toEqual([
      1,
    ]);
    expect(validate(s.record(s.number()), { x: 1 })).toEqual({ x: 1 });
    expect(errOf(() => validate(s.record(s.number()), { x: 'a' })).code).toBe('ZEN-1001');
  });

  it('union: اولین تطابق؛ عدم‌تطابق ⇒ ZEN-1001 با هر دو انتظار', () => {
    const sch = s.union([s.number(), s.string()]);
    expect(validate(sch, 1)).toBe(1);
    expect(validate(sch, 'a')).toBe('a');
    const e = errOf(() => validate(sch, true));
    expect(e.code).toBe('ZEN-1001');
    expect(e.details.issues[0].expected).toContain('number');
    expect(e.details.issues[0].expected).toContain('string');
  });

  it('optional/default/custom', () => {
    const sch = s.object({ x: s.optional(s.number()) });
    expect(validate(sch, {})).toEqual({});
    expect(validate(sch, { x: 2 })).toEqual({ x: 2 });

    const dfl = s.object({ ttl: s.default(s.number(), 1000) });
    expect(validate(dfl, {})).toEqual({ ttl: 1000 });
    expect(validate(dfl, { ttl: 5 })).toEqual({ ttl: 5 });

    const even = s.custom((v) => typeof v === 'number' && v % 2 === 0, 'even number');
    expect(validate(even, 4)).toBe(4);
    expect(errOf(() => validate(even, 3)).code).toBe('ZEN-1001');
  });
});

describe('ValidateOptions: mode / coerce / abortEarly / name', () => {
  it('mode=result throw نمی‌کند و مقدار خام برمی‌گرداند', () => {
    expect(validate(s.number(), 'x', { mode: 'result' })).toBe('x');
  });

  it('mode=warn به reporter تزریق‌شده می‌رود و throw نمی‌کند (بدون console در L0 — DEC-021 duck-seam؛ logger مصرف‌کننده را به consoleSink وصل می‌کند)', () => {
    const warns: string[] = [];
    setSchemaWarnReporter((msg) => warns.push(msg));
    try {
      expect(validate(s.number(), 'x', { mode: 'warn' })).toBe('x');
    } finally {
      setSchemaWarnReporter(undefined);
    }
    expect(warns.join('\n')).toMatch(/ZEN-1001/);
  });

  it('coerce: رشتهٔ عددی/بولی برای number/boolean', () => {
    expect(validate(s.number(), '5', { coerce: true })).toBe(5);
    expect(validate(s.boolean(), 'true', { coerce: true })).toBe(true);
    expect(errOf(() => validate(s.number(), 'abc', { coerce: true })).code).toBe('ZEN-1001');
  });

  it('abortEarly=true فقط اولین issue؛ false همه', () => {
    const sch = s.object({ a: s.number(), b: s.number() });
    const early = safeValidate(sch, { a: 'x', b: 'y' }, { abortEarly: true });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.issues).toHaveLength(1);
    const all = safeValidate(sch, { a: 'x', b: 'y' });
    if (!all.ok) {
      expect(all.issues).toHaveLength(2);
      expect(all.issues.map((i) => i.code)).toEqual(['ZEN-1001', 'ZEN-1001']);
    } else {
      throw new Error('expected failure');
    }
  });

  it('name در details.نام خطا می‌آید', () => {
    const e = errOf(() => validate(s.number(), 'x', { name: 'zen-chart' }));
    expect(e.details.name).toBe('zen-chart');
  });
});

describe('defineOptions (SPEC §۰.۲: DEFAULTS فریزشده + resolve)', () => {
  const { DEFAULTS, resolve, schema } = defineOptions(
    'chart',
    s.object({
      legend: s.default(s.boolean(), false),
      ttl: s.default(s.duration(), 1000),
      title: s.optional(s.string()),
    }),
  );

  it('DEFAULTS از گره‌های default ساخته و عمیقاً فریز می‌شود', () => {
    expect(DEFAULTS).toEqual({ legend: false, ttl: 1000 });
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('resolve بدون ورودی ⇒ پیش‌فرض‌ها؛ با ورودی ⇒ ادغام و اعتبارسنجی', () => {
    expect(resolve()).toEqual({ legend: false, ttl: 1000 });
    expect(resolve({ legend: true })).toEqual({ legend: true, ttl: 1000 });
    expect(resolve({ ttl: '30s' })).toEqual({ legend: false, ttl: 30000 }); // coerce در attribute-path نه؛ اینجا رشته؟ ttl duration رشته را coerce می‌کند
    expect(resolve({ title: 'x' })).toEqual({ legend: false, ttl: 1000, title: 'x' });
  });

  it('resolve روی کلید ناشناخته/مقدار نامعتبر throw ZEN-1002/1001 با نام API', () => {
    expect(errOf(() => resolve({ nope: 1 })).code).toBe('ZEN-1002');
    expect(errOf(() => resolve({ legend: 'yes' })).code).toBe('ZEN-1001');
  });

  it('defaults صریح بر schema default اولویت دارد؛ schema export در دسترس', () => {
    const o = defineOptions('v', s.object({ n: s.default(s.number(), 1) }), { n: 9 });
    expect(o.DEFAULTS).toEqual({ n: 9 });
    expect(o.resolve()).toEqual({ n: 9 });
    expect(schema.kind).toBe('object');
  });
});

describe('parseConfigAttr (JSON از attribute؛ ZEN-1003)', () => {
  const el = (json: string | null) =>
    ({
      getAttribute: (name: string) => (name === 'zen-chart-options' ? json : null),
    }) as unknown as Element;
  const sch = s.object({
    legend: s.default(s.boolean(), false),
    size: s.default(s.number(), 2),
  });

  it('JSON معتبر با coerce="5"→5', () => {
    expect(parseConfigAttr(el('{"legend":true,"size":"7"}'), 'zen-chart-options', sch)).toEqual({
      legend: true,
      size: 7,
    });
  });

  it('attribute نبود ⇒ فقط پیش‌فرض‌ها', () => {
    expect(parseConfigAttr(el(null), 'zen-chart-options', sch)).toEqual({ legend: false, size: 2 });
  });

  it('JSON خراب ⇒ ZEN-1003 با مقدار خام در details', () => {
    const e = errOf(() => parseConfigAttr(el('{oops}'), 'zen-chart-options', sch));
    expect(e.code).toBe('ZEN-1003');
    expect(e.details.value).toBe('{oops}');
  });

  it('مقدار نامعتبر در JSON ⇒ ZEN-1001 با مسیر', () => {
    const e = errOf(() => parseConfigAttr(el('{"size":"big"}'), 'zen-chart-options', sch));
    expect(e.code).toBe('ZEN-1001');
    expect(e.details.issues[0].path).toEqual(['size']);
  });
});
