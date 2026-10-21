// #142 — import در Node خالص (SSR): بدون window/document، خروجی deterministic.
import { describe, it, expect } from 'vitest';

describe('@zenith/schema imports cleanly in Node (no DOM)', () => {
  it('barrel exports the full SPEC §۲.۲ surface', async () => {
    const mod = await import('../src/index');
    for (const name of [
      's',
      'isSchemaNode',
      'validate',
      'safeValidate',
      'defineOptions',
      'parseConfigAttr',
      'setSchemaWarnReporter',
      'toJsonSchema',
      'fromJsonSchema',
      'defineDirectiveMeta',
      'getRegisteredDirectiveMetas',
      'toDirectiveManifest',
      'toHtmlCustomData',
    ]) {
      expect(mod as Record<string, unknown>, name).toHaveProperty(name);
    }
  });

  it('subpath /zod exports the duck-typed adapter (zod نصب نیست — نباید لازم باشد)', async () => {
    const mod = await import('../src/zod');
    expect(typeof mod.fromZod).toBe('function');
    expect(typeof mod.validateWithZod).toBe('function');
  });

  it('subpath /json-schema exports toJsonSchema + fromJsonSchema', async () => {
    const mod = await import('../src/json-schema');
    expect(typeof mod.toJsonSchema).toBe('function');
    expect(typeof mod.fromJsonSchema).toBe('function');
  });

  it('usable without window/document at all (SSR parity)', async () => {
    const { s, validate, toJsonSchema } = await import('../src/index');
    expect(validate(s.object({ a: s.number() }), { a: 1 })).toEqual({ a: 1 });
    expect(toJsonSchema(s.string()).type).toBe('string');
  });

  it('mode default resolves dev=throw/prod=warn via __ZENITH_DEV__ (DEC-020)', async () => {
    const { validate, setSchemaWarnReporter, s } = await import('../src/index');
    const prev = (globalThis as Record<string, unknown>).__ZENITH_DEV__;
    try {
      (globalThis as Record<string, unknown>).__ZENITH_DEV__ = false;
      const warns: string[] = [];
      setSchemaWarnReporter((m) => warns.push(m));
      expect(validate(s.number(), 'x')).toBe('x'); // prod ⇒ warn، throw नहीं
      expect(warns).toHaveLength(1);
      setSchemaWarnReporter(undefined);
      // reporter بریده شد ⇒ سکوت و بدون crash (هیچ console ای در L0 نیست)
      expect(validate(s.number(), 'x')).toBe('x');
      expect(warns).toHaveLength(1);
      (globalThis as Record<string, unknown>).__ZENITH_DEV__ = true;
      expect(() => validate(s.number(), 'x')).toThrow(/ZEN-1001/);
    } finally {
      if (prev === undefined) delete (globalThis as Record<string, unknown>).__ZENITH_DEV__;
      else (globalThis as Record<string, unknown>).__ZENITH_DEV__ = prev;
    }
  });
});
