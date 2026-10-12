// #142 — زیرمسیر /json-schema: toJsonSchema باید خروجی معتبر Draft 2020-12
// بدهد (گیت: اعتبارسنجی با meta-schema رسمی — ajv فقط devDependency ریشه) و
// fromJsonSchema مسیر برگشت subset را پیاده‌ کند.
import { describe, it, expect } from 'vitest';
import { toJsonSchema, fromJsonSchema } from '../src/json-schema';
import { s, validate } from '../src/index';
import Ajv2020 from 'ajv/dist/2020.js';

const ajv = new Ajv2020({ strict: false });

function expectValidMeta(doc: unknown): void {
  const valid = ajv.validateSchema(doc);
  expect(valid, `meta-schema errors: ${JSON.stringify(ajv.errors)}`).toBe(true);
}

describe('toJsonSchema — خروجی Draft 2020-12 معتبر (معیار پذیرش #142)', () => {
  it('leafها و nestها همگی با meta-schema پاس می‌شوند', () => {
    expectValidMeta(toJsonSchema(s.string({ min: 2, max: 5, pattern: '^a' })));
    expectValidMeta(toJsonSchema(s.number({ int: true, min: 0, max: 9 })));
    expectValidMeta(toJsonSchema(s.boolean()));
    expectValidMeta(toJsonSchema(s.enum(['a', 'b'])));
    expectValidMeta(toJsonSchema(s.duration({ min: 100 })));
    expectValidMeta(toJsonSchema(s.fn()));
    expectValidMeta(toJsonSchema(s.signal()));
    expectValidMeta(toJsonSchema(s.element()));
    expectValidMeta(toJsonSchema(s.custom(() => true, 'even number')));
    expectValidMeta(
      toJsonSchema(
        s.object({ a: s.number(), b: s.optional(s.string()), c: s.default(s.number(), 1) }),
      ),
    );
    expectValidMeta(toJsonSchema(s.array(s.string())));
    expectValidMeta(toJsonSchema(s.record(s.number())));
    expectValidMeta(toJsonSchema(s.union([s.number(), s.string()])));
  });

  it('ساختار انتظاری: $schema، restrictions، required/additionalProperties:false', () => {
    const doc = toJsonSchema(
      s.object({
        name: s.string({ min: 1 }),
        mode: s.enum(['fast', 'slow']),
        opt: s.optional(s.boolean()),
        ttl: s.default(s.duration(), 1000),
      }),
    );
    expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(doc.type).toBe('object');
    const props = doc.properties as Record<string, any>;
    expect(props.name.minLength).toBe(1);
    expect(props.mode.enum).toEqual(['fast', 'slow']);
    expect(doc.required).toEqual(['name', 'mode']);
    expect(doc.additionalProperties).toBe(false);
    expect((doc.default as Record<string, unknown>).ttl).toBe(1000);
  });

  it('fn/signal/element/custom با x-annotation قابل‌ردیابی (قانون patternProperties meta-schema)', () => {
    expect(toJsonSchema(s.fn())).toEqual({ $schema: expect.any(String), xzenithKind: 'fn' });
    const c = toJsonSchema(s.custom(() => true, 'even number'));
    expect(c.xzenithExpected).toBe('even number');
  });
});

describe('fromJsonSchema — subset رایج Draft 2020-12 به Schema', () => {
  it('object با required/optional + primitives', () => {
    const schema = fromJsonSchema({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 6 },
        count: { type: 'integer', minimum: 1 },
        flag: { type: 'boolean' },
        kind: { enum: ['a', 'b'] },
        maybe: { type: 'string' },
      },
      required: ['name', 'count', 'flag', 'kind'],
      additionalProperties: false,
    });
    expect(
      validate(schema, { name: 'abcd', count: 2, flag: true, kind: 'a' }, { strict: false }),
    ).toEqual({ name: 'abcd', count: 2, flag: true, kind: 'a' });
    // optional نبود ⇒ اشکالی ندارد
    expect(() => validate(schema, { name: 'x', count: 2, flag: true, kind: 'a' })).toThrow(
      /ZEN-1004/,
    );
    expect(() => validate(schema, { name: 'xx', count: 1.5, flag: true, kind: 'a' })).toThrow(
      /ZEN-1001/,
    );
  });

  it('array/record/anyOf', () => {
    expect(validate(fromJsonSchema({ type: 'array', items: { type: 'number' } }), [1, 2])).toEqual([
      1, 2,
    ]);
    const rec = fromJsonSchema({ type: 'object', additionalProperties: { type: 'number' } });
    expect(validate(rec, { x: 1 })).toEqual({ x: 1 });
    const u = fromJsonSchema({ anyOf: [{ type: 'number' }, { type: 'string' }] });
    expect(validate(u, 's')).toBe('s');
    expect(() => validate(u, true)).toThrow(/ZEN-1001/);
  });

  it('round-trip: toJsonSchema(s.object) دوباره به fromJsonSchema ⇒ همان مقادیر درست رد می‌شوند', () => {
    const orig = s.object({ a: s.string({ min: 2 }), b: s.number({ int: true }) });
    const revived = fromJsonSchema(toJsonSchema(orig));
    expect(validate(revived, { a: 'xx', b: 3 })).toEqual({ a: 'xx', b: 3 });
    expect(() => validate(revived, { a: 'x', b: 3 })).toThrow(/ZEN-1004/);
  });

  it('ورودی غیر object ⇒ TypeError با پیشوند [ZEN-1001]', () => {
    expect(() => fromJsonSchema(null as never)).toThrow(/^\[ZEN-1001]/);
  });
});
