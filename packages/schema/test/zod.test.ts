// #142 — زیرمسیر /zod: آداپتور دونگی (zod هیچ‌وقت dep نیست — DEC-021/#141).
import { describe, it, expect } from 'vitest';
import { fromZod, validateWithZod, type ZodLike } from '../src/zod';
import { validate, safeValidate, s } from '../src/index';

function fakeZod(rules: Array<(v: unknown) => string | null>): ZodLike {
  return {
    safeParse(data) {
      const issues: Array<{ path: (string | number)[]; message: string }> = [];
      for (const rule of rules) {
        const msg = rule(data);
        if (msg) issues.push({ path: [], message: msg });
      }
      return issues.length ? { success: false, error: { issues } } : { success: true, data };
    },
  };
}

describe('fromZod (duck, no zod install)', () => {
  it('grhe custom با expected="zod schema" می‌سازد که در nestها کار می‌کند', () => {
    const zod = fakeZod([(v) => (typeof v === 'string' ? null : 'must be string')]);
    const node = fromZod(zod);
    expect(node.kind).toBe('custom');
    expect(validate(s.object({ a: node }), { a: 'ok' })).toEqual({ a: 'ok' });
    const e = (() => {
      try {
        validate(s.object({ a: node }), { a: 1 });
      } catch (err) {
        return err as any;
      }
      throw new Error('expected throw');
    })();
    expect(e.code).toBe('ZEN-1001');
    expect(e.details.issues[0].expected).toBe('zod schema');
  });

  it('safeParse throw ⇒ custom fail، نه crash', () => {
    const broken: ZodLike = {
      safeParse() {
        throw new Error('boom');
      },
    };
    const res = safeValidate(fromZod(broken), 'x');
    expect(res.ok).toBe(false);
  });
});

describe('validateWithZod (layer-clean؛ FormStore نمی‌سازد — DEC-029)', () => {
  it('موفق ⇒ ok:true با مقدار zod (data)؛ failure ⇒ issues نگاشت‌شده با code ZEN-1001', () => {
    const zod = fakeZod([(v) => ((v as { n?: number }).n! > 0 ? null : 'n must be positive')]);
    const ok = validateWithZod(zod, { n: 1 });
    expect(ok.ok).toBe(true);
    const bad = validateWithZod(zod, { n: 0 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues).toHaveLength(1);
      expect(bad.issues[0].code).toBe('ZEN-1001');
      expect(bad.issues[0].message).toBe('n must be positive');
    }
  });

  it('safeParse throw ⇒ issue با پیام exception', () => {
    const broken: ZodLike = {
      safeParse() {
        throw new TypeError('nope');
      },
    };
    const res = validateWithZod(broken, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues[0].message).toBe('nope');
  });
});
