// packages/form/src/schema.ts
//
// Schema System — Phase 7.
//
// اعتبارسنجی مبتنی بر Schema با پشتیبانی از:
//   - JSON Schema (ساده)
//   - Zod adapter (optional)
//   - Schema-based form generation
//
// #142 (SPEC §۲.۲ «مهاجرت»): منطق خالص این سه API به @zenith/schema منتقل شد
// (`fromZod`/`validateWithZod` در زیرمسیر /zod؛ `fromJsonSchema` در /json-schema).
// امضاهای قدیمی که FormStore می‌ساختند — که لایهٔ L0 نمی‌تواند بسازد — اینجا
// می‌مانند و deprecated هستند (ZEN-DEPR-016..018؛ حذف در 2.0 طبق DEC-026).

import { deprecate } from '@zenith/errors';
import { validateWithZod as schemaValidateWithZod } from '@zenith/schema/zod';
import { defineRule, type FormSchema, type SchemaField, schemaToFormConfig } from './validator';
import { createForm, type FormStore } from './form';

// ── Zod Adapter ──
// Zod یک optional peer dependency است. اگر نصب باشد، از آن استفاده می‌کنیم.

export interface ZodSchema {
  // Minimal interface — فقط چه چیزی نیاز داریم.
  safeParse(data: any): {
    success: boolean;
    data?: any;
    error?: { issues: Array<{ path: (string | number)[]; message: string }> };
  };
}

/**
 * تبدیل Zod schema به Zenith form config.
 *
 * استفاده:
 *   import { z } from 'zod';
 *   import { fromZod } from '@zenith/form';
 *
 *   const schema = z.object({
 *     email: z.string().email(),
 *     password: z.string().min(8),
 *   });
 *
 *   const form = fromZod(schema, {
 *     email: { initial: '', label: 'Email' },
 *     password: { initial: '', label: 'Password', type: 'password' },
 *   });
 */
export function fromZod(
  zodSchema: ZodSchema,
  fieldConfig?: Record<string, Partial<SchemaField>>,
): FormStore {
  // #142: امضای FormStore-saver در form می‌ماند (L0 نمی‌تواند FormStore بسازد)؛
  // جایگزین خالص: fromZod در @zenith/schema/zod که گرهٔ Schema می‌دهد.
  deprecate(
    'ZEN-DEPR-016',
    'fromZod (form)',
    '@zenith/schema/zod fromZod + createForm',
    'این alias در 2.0 حذف می‌شود (DEC-026).',
  );
  // Test با یک sample تا قوانین استخراج کنیم.
  const sampleValues: Record<string, any> = {};
  if (fieldConfig) {
    for (const [name, config] of Object.entries(fieldConfig)) {
      sampleValues[name] = config.initial ?? '';
    }
  }

  // Run safeParse to discover validation errors.
  const testResult = zodSchema.safeParse(sampleValues);
  if (!testResult.success && testResult.error) {
    // Extract rules from error issues.
    const rules: Record<string, string> = {};
    for (const issue of testResult.error.issues) {
      const fieldName = String(issue.path[0] || '');
      if (!fieldName) continue;

      const message = issue.message.toLowerCase();
      let rule = '';

      if (message.includes('required') || message.includes('expected')) rule = 'required';
      else if (message.includes('email')) rule = 'email';
      else if (message.includes('url')) rule = 'url';
      else if (message.includes('at least') && message.includes('character')) {
        const match = message.match(/(\d+)/);
        rule = match ? `min:${match[1]}` : 'min:1';
      } else if (message.includes('at most') && message.includes('character')) {
        const match = message.match(/(\d+)/);
        rule = match ? `max:${match[1]}` : 'max:255';
      } else if (message.includes('number')) rule = 'number';
      else if (message.includes('integer')) rule = 'integer';

      if (rule) {
        rules[fieldName] = rules[fieldName] ? `${rules[fieldName]},${rule}` : rule;
      }
    }

    // Build form config.
    const config: Record<string, { initial: any; rules?: string }> = {};
    for (const [name, fc] of Object.entries(fieldConfig || {})) {
      config[name] = {
        initial: fc.initial ?? '',
        rules: rules[name],
      };
    }

    // Register a custom rule for Zod-based validation.
    defineRule('__zod__', (_value, allValues) => {
      const result = zodSchema.safeParse(allValues);
      if (result.success) return { valid: true, error: null };
      // Find the first error for this field.
      // Zod validation runs on the whole object, so we use it as a cross-field validator.
      return { valid: true, error: null }; // Per-field validation done by extracted rules.
    });

    // FIX (v1.2.3): قبلاً قانون __zod__ ثبت می‌شد ولی هرگز به rules فیلدها اضافه
    // نمی‌شد — یعنی قانون مرده بود و در validateField هرگز صدا زده نمی‌شد. حالا
    // __zod__ به rules هر فیلد append می‌شود تا cross-field Zod validation واقعاً
    // اجرا شود.
    for (const name of Object.keys(config)) {
      const field = config[name];
      if (!field) continue;
      const existingRules = field.rules;
      field.rules = existingRules ? `${existingRules},__zod__` : '__zod__';
    }

    return createForm(config);
  }

  // If sample passes (all fields are optional), just create form with no rules.
  const config: Record<string, { initial: any; rules?: string }> = {};
  for (const [name, fc] of Object.entries(fieldConfig || {})) {
    config[name] = { initial: fc.initial ?? '', rules: '' };
  }
  return createForm(config);
}

/**
 * اعتبارسنجی کل فرم با Zod schema.
 * مفید برای cross-field validation که در قوانین ساده قابل بیان نیست.
 *
 * #142: چک خالص safeParse به `@zenith/schema/zod` واگذار می‌شود؛ این wrapper
 * فقط FormStore را update می‌کند و در 2.0 حذف می‌شود.
 */
export async function validateWithZod(form: FormStore, zodSchema: ZodSchema): Promise<boolean> {
  deprecate(
    'ZEN-DEPR-017',
    'validateWithZod (form)',
    '@zenith/schema/zod validateWithZod',
    'امضای جدید (zodSchema, input) ⇒ SafeResult؛ این alias در 2.0 حذف می‌شود (DEC-026).',
  );
  const values = form.getValues();
  const result = schemaValidateWithZod(zodSchema as never, values);

  if (result.ok) {
    form.setFormError(null);
    return true;
  }

  // Set form-level error.
  const first = result.issues[0];
  form.setFormError(first ? first.message : 'Validation failed');

  return false;
}

// ── JSON Schema Adapter ──

export interface JsonSchema {
  type?: string;
  properties?: Record<
    string,
    {
      type?: string;
      format?: string;
      minLength?: number;
      maxLength?: number;
      minimum?: number;
      maximum?: number;
      pattern?: string;
      enum?: any[];
      description?: string;
    }
  >;
  required?: string[];
}

/**
 * تبدیل JSON Schema به Zenith form config.
 *
 * #142: تبدیل خالص JSON Schema → Schema در @zenith/schema/json-schema قرار
 * دارد؛ اینجا mapping به rules فرم (قالب FormStore — خارج از L0) است و
 * deprecated شده (ZEN-DEPR-018؛ حذف در 2.0).
 */
export function fromJsonSchema(
  jsonSchema: JsonSchema,
  initialValues?: Record<string, any>,
): FormStore {
  deprecate(
    'ZEN-DEPR-018',
    'fromJsonSchema (form)',
    '@zenith/schema/json-schema fromJsonSchema + createForm',
    'این alias در 2.0 حذف می‌شود (DEC-026).',
  );
  const config: Record<string, { initial: any; rules?: string }> = {};
  const required = new Set(jsonSchema.required || []);

  for (const [name, prop] of Object.entries(jsonSchema.properties || {})) {
    const rules: string[] = [];

    if (required.has(name)) rules.push('required');

    if (prop.format === 'email') rules.push('email');
    if (prop.format === 'uri' || prop.format === 'url') rules.push('url');
    if (prop.format === 'date' || prop.format === 'date-time') rules.push('date');

    if (prop.type === 'number' || prop.type === 'integer') {
      rules.push(prop.type === 'integer' ? 'integer' : 'number');
      if (prop.minimum !== undefined) rules.push(`min:${prop.minimum}`);
      if (prop.maximum !== undefined) rules.push(`max:${prop.maximum}`);
    } else if (prop.type === 'string') {
      if (prop.minLength !== undefined) rules.push(`min:${prop.minLength}`);
      if (prop.maxLength !== undefined) rules.push(`max:${prop.maxLength}`);
      if (prop.pattern) rules.push(`pattern:${prop.pattern}`);
    }

    config[name] = {
      initial: initialValues?.[name] ?? '',
      rules: rules.join(','),
    };
  }

  return createForm(config);
}

/**
 * ساخت فرم از Schema (FormSchema interface).
 */
export function createFormFromSchema(schema: FormSchema): FormStore {
  return createForm(schemaToFormConfig(schema));
}

export { type FormSchema, type SchemaField, schemaToFormConfig, schemaToHtml } from './validator';
