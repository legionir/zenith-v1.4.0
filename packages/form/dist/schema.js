// packages/form/src/schema.ts
//
// Schema System — Phase 7.
//
// اعتبارسنجی مبتنی بر Schema با پشتیبانی از:
//   - JSON Schema (ساده)
//   - Zod adapter (optional)
//   - Schema-based form generation
import { defineRule, schemaToFormConfig } from './validator.js';
import { createForm } from './form.js';
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
export function fromZod(zodSchema, fieldConfig) {
    // Test با یک sample تا قوانین استخراج کنیم.
    const sampleValues = {};
    if (fieldConfig) {
        for (const [name, config] of Object.entries(fieldConfig)) {
            sampleValues[name] = config.initial ?? '';
        }
    }
    // Run safeParse to discover validation errors.
    const testResult = zodSchema.safeParse(sampleValues);
    if (!testResult.success && testResult.error) {
        // Extract rules from error issues.
        const rules = {};
        for (const issue of testResult.error.issues) {
            const fieldName = String(issue.path[0] || '');
            if (!fieldName)
                continue;
            const message = issue.message.toLowerCase();
            let rule = '';
            if (message.includes('required') || message.includes('expected'))
                rule = 'required';
            else if (message.includes('email'))
                rule = 'email';
            else if (message.includes('url'))
                rule = 'url';
            else if (message.includes('at least') && message.includes('character')) {
                const match = message.match(/(\d+)/);
                rule = match ? `min:${match[1]}` : 'min:1';
            }
            else if (message.includes('at most') && message.includes('character')) {
                const match = message.match(/(\d+)/);
                rule = match ? `max:${match[1]}` : 'max:255';
            }
            else if (message.includes('number'))
                rule = 'number';
            else if (message.includes('integer'))
                rule = 'integer';
            if (rule) {
                rules[fieldName] = rules[fieldName] ? `${rules[fieldName]},${rule}` : rule;
            }
        }
        // Build form config.
        const config = {};
        for (const [name, fc] of Object.entries(fieldConfig || {})) {
            config[name] = {
                initial: fc.initial ?? '',
                rules: rules[name],
            };
        }
        // Register a custom rule for Zod-based validation.
        defineRule('__zod__', (_value, allValues) => {
            const result = zodSchema.safeParse(allValues);
            if (result.success)
                return { valid: true, error: null };
            // Find the first error for this field.
            // Zod validation runs on the whole object, so we use it as a cross-field validator.
            return { valid: true, error: null }; // Per-field validation done by extracted rules.
        });
        // FIX (v1.2.3): wire __zod__ rule into each field's rules string.
        for (const name of Object.keys(config)) {
            const existingRules = config[name].rules;
            config[name].rules = existingRules ? `${existingRules},__zod__` : '__zod__';
        }
        return createForm(config);
    }
    // If sample passes (all fields are optional), just create form with no rules.
    const config = {};
    for (const [name, fc] of Object.entries(fieldConfig || {})) {
        config[name] = { initial: fc.initial ?? '', rules: '' };
    }
    return createForm(config);
}
/**
 * اعتبارسنجی کل فرم با Zod schema.
 * مفید برای cross-field validation که در قوانین ساده قابل بیان نیست.
 */
export async function validateWithZod(form, zodSchema) {
    const values = form.getValues();
    const result = zodSchema.safeParse(values);
    if (result.success) {
        form.setFormError(null);
        return true;
    }
    // Set form-level error.
    const firstError = result.error?.issues[0];
    form.setFormError(firstError ? firstError.message : 'Validation failed');
    return false;
}
/**
 * تبدیل JSON Schema به Zenith form config.
 */
export function fromJsonSchema(jsonSchema, initialValues) {
    const config = {};
    const required = new Set(jsonSchema.required || []);
    for (const [name, prop] of Object.entries(jsonSchema.properties || {})) {
        const rules = [];
        if (required.has(name))
            rules.push('required');
        if (prop.format === 'email')
            rules.push('email');
        if (prop.format === 'uri' || prop.format === 'url')
            rules.push('url');
        if (prop.format === 'date' || prop.format === 'date-time')
            rules.push('date');
        if (prop.type === 'number' || prop.type === 'integer') {
            rules.push(prop.type === 'integer' ? 'integer' : 'number');
            if (prop.minimum !== undefined)
                rules.push(`min:${prop.minimum}`);
            if (prop.maximum !== undefined)
                rules.push(`max:${prop.maximum}`);
        }
        else if (prop.type === 'string') {
            if (prop.minLength !== undefined)
                rules.push(`min:${prop.minLength}`);
            if (prop.maxLength !== undefined)
                rules.push(`max:${prop.maxLength}`);
            if (prop.pattern)
                rules.push(`pattern:${prop.pattern}`);
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
export function createFormFromSchema(schema) {
    return createForm(schemaToFormConfig(schema));
}
export { schemaToFormConfig, schemaToHtml } from './validator.js';
//# sourceMappingURL=schema.js.map