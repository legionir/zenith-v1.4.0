// #142 — تولید JSON Schema Draft 2020-12 از گره‌های schema (SPEC §۲.۲).
//
// خروجی plain JSON است (بدون closure؛ گره‌های `custom` به‌صورت `{}` باز +
// x-expected توضیحی serialize می‌شوند). تست با meta-schema رسمی Draft 2020-12
// (ajv — فقط devDependency؛ zod/ajv هیچ‌کدام runtime dep نیستند — ADR).
import { s, type Schema } from './s';
import type { JsonSchema, SchemaNode } from './types';

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

function mapNode(node: SchemaNode): JsonSchema {
  switch (node.kind) {
    case 'string': {
      const out: JsonSchema = { type: 'string' };
      if (node.min !== undefined) out.minLength = node.min;
      if (node.max !== undefined) out.maxLength = node.max;
      if (node.pattern !== undefined) out.pattern = node.pattern;
      return out;
    }
    case 'number': {
      const out: JsonSchema = node.int ? { type: 'integer' } : { type: 'number' };
      if (node.min !== undefined) out.minimum = node.min;
      if (node.max !== undefined) out.maximum = node.max;
      return out;
    }
    case 'boolean':
      return { type: 'boolean' };
    case 'enum':
      return { enum: [...node.values] };
    case 'duration': {
      // number (ms) یا رشتهٔ واحددار؛ بازه در صورت اعلام.
      const any: JsonSchema[] = [
        {
          type: 'number',
          minimum: node.min ?? 0,
          ...(node.max !== undefined ? { maximum: node.max } : {}),
        },
        { type: 'string', pattern: '^(never|\\d+(?:\\.\\d+)?(ms|s|m|h)?)$' },
      ];
      return { anyOf: any };
    }
    case 'fn':
      // JS function قابل بیان در JSON Schema نیست ⇒ «هرچیز» + x-zenith-kind.
      return { xzenithKind: 'fn' };
    case 'signal':
      return { xzenithKind: 'signal' };
    case 'element':
      return { xzenithKind: 'element' };
    case 'array':
      return { type: 'array', items: mapNode(node.item) };
    case 'record':
      return { type: 'object', additionalProperties: mapNode(node.value) };
    case 'object': {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      const defaults: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.shape)) {
        properties[key] = mapNode(child);
        if (child.kind !== 'optional' && child.kind !== 'default') required.push(key);
        if (child.kind === 'default' && child.value !== undefined) defaults[key] = child.value;
      }
      const out: JsonSchema = { type: 'object', properties, additionalProperties: false };
      if (required.length > 0) out.required = required;
      if (Object.keys(defaults).length > 0) out.default = defaults;
      return out;
    }
    case 'union':
      return { anyOf: node.options.map(mapNode) };
    case 'optional': {
      const inner = mapNode(node.inner);
      // optional در 2020-12 = نبودِ کلید؛ این گره خودش value را توصیف می‌کند
      // و «نبود» را parent (object) با حذف از required بیان می‌کند.
      return inner;
    }
    case 'default': {
      const inner = mapNode(node.inner);
      return { ...inner, default: node.value };
    }
    case 'custom':
      return { xzenithKind: 'custom', xzenithExpected: node.expected };
    default:
      return {};
  }
}

/** JSON Schema Draft 2020-12 معتبر از یک schema بده. */
export function toJsonSchema<T>(schema: Schema<T>): JsonSchema {
  const body = mapNode(schema as unknown as SchemaNode);
  return { $schema: DRAFT, ...body };
}

// ── fromJsonSchema (زیرمسیر `@zenith/schema/json-schema` — SPEC §۲.۲) ──
//
// مپ یک‌طرفۀ JSON Schema (subset رایج: type/format/min/max/pattern/enum/
// required/properties/items/additionalProperties/anyOf) به گره‌های `s.*`.
// سازندۀ جایگزین `form.fromJsonSchema` قدیمی که FormStore می‌ساخت؛ آن API
// در form می‌ماند (signature ناسازگار — DEC-029) و فقط deprecate می‌شود.

function asDoc(v: unknown): JsonSchema | undefined {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as JsonSchema) : undefined;
}

function fromNode(doc: JsonSchema): Schema<unknown> {
  if (Array.isArray(doc.anyOf)) {
    const alts = doc.anyOf
      .map((x) => (asDoc(x) ? fromNode(asDoc(x)!) : undefined))
      .filter((x): x is Schema<unknown> => x !== undefined);
    // anyOf با یک شاخه در JSON Schema معتبر است؛ s.union دو-به-بالا می‌خواهد.
    if (alts.length === 1) return alts[0]!;
    if (alts.length > 1)
      return s.union(alts as [Schema<unknown>, Schema<unknown>, ...Schema<unknown>[]]);
  }
  if (Array.isArray(doc.enum)) {
    return s.enum(doc.enum as (string | number | boolean)[]);
  }
  if (Array.isArray(doc.allOf) || Array.isArray(doc.oneOf)) {
    // ترکیب‌های پیشرفته پشتیبان نمی‌شوند ⇒ دونگی true (هر مقدار می‌گذرد).
    return s.custom(() => true, 'json-schema composite');
  }

  const req = new Set(Array.isArray(doc.required) ? (doc.required as string[]) : []);
  const props = asDoc(doc.properties);

  switch (doc.type) {
    case 'object': {
      if (props) {
        const shape: Record<string, Schema<unknown>> = {};
        for (const [key, raw] of Object.entries(props)) {
          const child = asDoc(raw);
          if (!child) continue;
          const node = fromNode(child);
          shape[key] = req.has(key) ? node : s.optional(node);
        }
        return s.object(shape);
      }
      if (asDoc(doc.additionalProperties)) {
        return s.record(fromNode(asDoc(doc.additionalProperties)!));
      }
      return s.custom((v) => typeof v === 'object' && v !== null && !Array.isArray(v), 'object');
    }
    case 'array': {
      const item = asDoc(doc.items);
      return s.array(item ? fromNode(item) : s.custom(() => true, 'any'));
    }
    case 'string': {
      const opts: { min?: number; max?: number; pattern?: string } = {};
      if (typeof doc.minLength === 'number') opts.min = doc.minLength;
      if (typeof doc.maxLength === 'number') opts.max = doc.maxLength;
      if (typeof doc.pattern === 'string') opts.pattern = doc.pattern;
      return s.string(opts);
    }
    case 'number':
    case 'integer': {
      const opts: { min?: number; max?: number; int?: boolean } = {};
      if (doc.type === 'integer') opts.int = true;
      if (typeof doc.minimum === 'number') opts.min = doc.minimum;
      if (typeof doc.maximum === 'number') opts.max = doc.maximum;
      return s.number(opts);
    }
    case 'boolean':
      return s.boolean();
    default:
      // بدون type: هر مقداری می‌گذرد (document subset رایج).
      return s.custom(() => true, 'any');
  }
}

/**
 * تبدیل JSON Schema (subset Draft 2020-12) به Schema. ورودی non-object ⇒
 * TypeError با پیشوند `[ZEN-1001]` (الگوی shared/assert.ts — خطای مصرفیِ
 * internal نیست که لازم باشد ZenithError باشد).
 */
export function fromJsonSchema(doc: JsonSchema): Schema<unknown> {
  const d = asDoc(doc);
  if (!d) {
    throw new TypeError('[ZEN-1001] fromJsonSchema: ورودی باید یک JSON Schema object باشد.');
  }
  return fromNode(d);
}
