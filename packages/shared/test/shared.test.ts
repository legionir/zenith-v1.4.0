// @vitest-environment jsdom
//
// #141 — @zenith/shared: ابزارهای خالص L0 (مطابق NEW-PACKAGES-SPEC بند ۲.۱).
// قراردادها که این فایل می‌قفل کند:
//   • mergeOptions امن در برابر prototype pollution (بندهای «معیار پذیرش» #141)
//   • parseDuration مرزها: "0"، "1.5s"، "-1"، "abc" (+ قاعدهٔ بند ۰.۲: عدد = ms)
//   • createDisposer ترتیب LIFO + idempotency
//   • createId قطعی در SSR (شمارندهٔ از نو قابل‌شروع)
//   • secureId canonical در shared با همان قرارداد امنیتی #64 (CSPRNG، ZEN-403)
//   • invariant خطای ساختارمند با کد رزورشدهٔ ZEN-1090 (#171)
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mergeOptions,
  parseDuration,
  parseBooleanAttr,
  parseNumberAttr,
  createDisposer,
  defineDefaults,
  toValue,
  isReadable,
  isServer,
  hasDOM,
  hasWindow,
  createId,
  resetIdCounter,
  secureId,
  invariant,
} from '../src/index';
import { isZenithError } from '@zenith/errors';

describe('mergeOptions — ادغام امن گزینه‌ها (#141)', () => {
  it('merges user values over defaults', () => {
    const defaults = { a: 1, b: 'x', c: true };
    expect(mergeOptions(defaults, { b: 'y' })).toEqual({ a: 1, b: 'y', c: true });
  });

  it('returns a new object and never mutates defaults', () => {
    const defaults = { a: 1 };
    const out = mergeOptions(defaults, { a: 2 });
    expect(out).toEqual({ a: 2 });
    expect(defaults.a).toBe(1);
    expect(out).not.toBe(defaults);
  });

  it('ignores undefined user values (defaults win)', () => {
    expect(mergeOptions({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  it('drops unknown keys (no free-for-all extension)', () => {
    const out = mergeOptions<{ a: number }>({ a: 1 }, { a: 2, sneaky: 9 } as never);
    expect(out).toEqual({ a: 2 });
    expect('sneaky' in out).toBe(false);
  });

  it('is safe against __proto__ / constructor / prototype pollution', () => {
    const payloads = [
      '{"__proto__":{"polluted":1}}',
      '{"constructor":{"prototype":{"polluted":1}}}',
      '{"prototype":{"polluted":1}}',
    ];
    for (const json of payloads) {
      const evil = JSON.parse(json);
      const out = mergeOptions({ a: 1 }, evil);
      expect(({} as Record<string, unknown>)['polluted'], json).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>)['polluted']).toBeUndefined();
      expect(out).toEqual({ a: 1 });
    }
  });

  it('ignores inherited properties (own keys only)', () => {
    const parent = { inherited: 42 };
    const user = Object.create(parent) as Record<string, unknown>;
    user['a'] = 2;
    expect(mergeOptions({ a: 1 }, user)).toEqual({ a: 2 });
  });
});

describe('parseDuration — قاعدهٔ بند ۰.۲ (#141)', () => {
  it('parses suffixed durations to ms', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('1h')).toBe(3_600_000);
  });

  it('treats bare numbers as ms (string or number)', () => {
    expect(parseDuration('30')).toBe(30);
    expect(parseDuration(300)).toBe(300);
  });

  it('accepts the boundaries required by the issue: "0" and "1.5s"', () => {
    expect(parseDuration('0')).toBe(0);
    expect(parseDuration('1.5s')).toBe(1500);
  });

  it('rejects "-1" and "abc" with NaN', () => {
    expect(parseDuration('-1')).toBeNaN();
    expect(parseDuration('abc')).toBeNaN();
    expect(parseDuration(-1)).toBeNaN();
  });

  it('rejects malformed units/spacing', () => {
    expect(parseDuration('10 seconds')).toBeNaN();
    expect(parseDuration('s')).toBeNaN();
    expect(parseDuration('')).toBeNaN();
    expect(parseDuration('1.2.3s')).toBeNaN();
    expect(parseDuration(Infinity)).toBeNaN();
  });

  it('maps never to the "never" sentinel', () => {
    expect(parseDuration('never')).toBe('never');
    expect(parseDuration(' NEVER ')).toBe('never');
  });
});

describe('parseBooleanAttr — قاعدهٔ بند ۰.۳ (#141)', () => {
  it('absent attribute returns the default', () => {
    expect(parseBooleanAttr(null, false)).toBe(false);
    expect(parseBooleanAttr(null, true)).toBe(true);
  });

  it('explicit "false" disables, "true"/empty enables', () => {
    expect(parseBooleanAttr('false', true)).toBe(false);
    expect(parseBooleanAttr('true', false)).toBe(true);
    expect(parseBooleanAttr('', false)).toBe(true);
  });

  it('anything else falls back to the default', () => {
    expect(parseBooleanAttr('yes', true)).toBe(true);
    expect(parseBooleanAttr('yes', false)).toBe(false);
  });
});

describe('parseNumberAttr (#141)', () => {
  it('parses plain numeric literals', () => {
    expect(parseNumberAttr('300', 0)).toBe(300);
    expect(parseNumberAttr('-2.5', 0)).toBe(-2.5);
  });

  it('absent attribute or unparsable/:expression values return the default', () => {
    expect(parseNumberAttr(null, 7)).toBe(7);
    expect(parseNumberAttr('abc', 7)).toBe(7);
    expect(parseNumberAttr(':cfg.delay', 7)).toBe(7);
  });
});

describe('createDisposer — LIFO + idempotency (#141)', () => {
  it('runs cleanups in LIFO order', () => {
    const order: number[] = [];
    const d = createDisposer();
    d.add(() => order.push(1));
    d.add(() => order.push(2));
    d.add(() => order.push(3));
    d.dispose();
    expect(order).toEqual([3, 2, 1]);
  });

  it('is idempotent: a second dispose runs nothing again', () => {
    const fn = vi.fn();
    const d = createDisposer();
    d.add(fn);
    d.dispose();
    d.dispose();
    d.run();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('accepts Disposable objects and runs them via dispose()', () => {
    const d = createDisposer();
    let disposed = false;
    d.add({ dispose: () => (disposed = true) });
    d.dispose();
    expect(disposed).toBe(true);
  });

  it('adding after disposal is a no-op (no late cleanup leak)', () => {
    const fn = vi.fn();
    const d = createDisposer();
    d.dispose();
    d.add(fn);
    d.run();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('defineDefaults — فریز عمیق (#141)', () => {
  it('deep-freezes plain objects and arrays', () => {
    const frozen = defineDefaults({ nested: { a: 1 }, list: [1, 2] });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.list)).toBe(true);
  });

  it('throws ZEN-1090 for non-object input', () => {
    let caught: unknown;
    try {
      defineDefaults(5 as never);
    } catch (err) {
      caught = err;
    }
    expect(isZenithError(caught)).toBe(true);
    expect((caught as { code: string }).code).toBe('ZEN-1090');
  });
});

describe('toValue / isReadable (#141)', () => {
  it('reads plain values as-is', () => {
    expect(toValue(42)).toBe(42);
    expect(toValue('x')).toBe('x');
    expect(toValue(null)).toBe(null);
  });

  it('calls get() on readable containers', () => {
    expect(toValue({ get: () => 7 })).toBe(7);
  });

  it('isReadable accepts only objects with a get function', () => {
    expect(isReadable({ get: () => 1 })).toBe(true);
    expect(isReadable({ get: 2 })).toBe(false);
    expect(isReadable(5)).toBe(false);
    expect(isReadable(null)).toBe(false);
    expect(isReadable('str')).toBe(false);
  });
});

describe('تشخیص محیط — isServer/hasDOM/hasWindow (#141)', () => {
  it('reports the jsdom environment (window+document present ⇒ not server)', () => {
    expect(hasWindow()).toBe(true);
    expect(hasDOM()).toBe(true);
    expect(isServer()).toBe(false);
  });
});

describe('createId — قطعی در SSR (#141)', () => {
  it('generates increasing ids with the default prefix', () => {
    resetIdCounter();
    expect(createId()).toBe('zen-1');
    expect(createId()).toBe('zen-2');
  });

  it('supports a custom prefix', () => {
    resetIdCounter();
    expect(createId('dialog')).toBe('dialog-1');
  });

  it('is deterministic across "processes": reset restarts the counter', () => {
    resetIdCounter();
    const first = [createId('a'), createId('a')];
    resetIdCounter();
    const second = [createId('a'), createId('a')];
    expect(second).toEqual(first);
  });
});

describe('secureId — canonical در shared با قرارداد #64', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns lowercase hex of bytes*2 chars', () => {
    const id = secureId(8);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(secureId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('uses crypto.getRandomValues, never Math.random', () => {
    const spy = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) & 0xff;
      return arr;
    });
    vi.stubGlobal('crypto', { getRandomValues: spy });
    const mathRandom = vi.spyOn(Math, 'random');
    const id = secureId(4);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    mathRandom.mockRestore();
  });

  it('is unique across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(secureId());
    expect(seen.size).toBe(200);
  });

  it('throws ZEN-403 when crypto is unavailable (no insecure fallback)', () => {
    vi.stubGlobal('crypto', undefined);
    let caught: unknown;
    try {
      secureId();
    } catch (err) {
      caught = err;
    }
    expect(isZenithError(caught)).toBe(true);
    expect((caught as { code: string }).code).toBe('ZEN-403');
  });

  it('throws ZEN-403 for invalid byte length', () => {
    for (const bad of [0, -1, 1.5, 1025, 'x' as never]) {
      let caught: unknown;
      try {
        secureId(bad);
      } catch (err) {
        caught = err;
      }
      expect(isZenithError(caught), String(bad)).toBe(true);
      expect((caught as { code: string }).code).toBe('ZEN-403');
    }
  });
});

describe('invariant — خطای ساختارمند با ZEN-1090 (#141/#171)', () => {
  it('returns silently when the condition holds', () => {
    expect(() => invariant(1 === 1, 'ok')).not.toThrow();
    expect(() => invariant({ a: 1 }, 'object truthy')).not.toThrow();
  });

  it('throws a ZenithError with ZEN-1090, custom message and details', () => {
    let caught: unknown;
    try {
      invariant(false, 'ttl باید ≥ ۰ باشد', { details: { ttl: -5 } });
    } catch (err) {
      caught = err;
    }
    expect(isZenithError(caught)).toBe(true);
    const e = caught as { code: string; message: string; details?: Record<string, unknown> };
    expect(e.code).toBe('ZEN-1090');
    expect(e.message).toContain('ttl باید ≥ ۰ باشد');
    expect(e.details).toMatchObject({ ttl: -5 });
    expect(e.message).toContain('[ZEN-1090]');
  });

  it('rejects empty messages with ZEN-1090', () => {
    let caught: unknown;
    try {
      invariant(false, '   ');
    } catch (err) {
      caught = err;
    }
    expect((caught as { code: string }).code).toBe('ZEN-1090');
  });
});
