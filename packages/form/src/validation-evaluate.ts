import type { FormValidationLifecycle } from './validation-types';
import { logger } from '@zenith/logger';
import type { FieldValidation, FormValidation } from './validation-types';
import { builtinRules } from './validation-builtins';
import { customRules, asyncRules, parseRules } from './validation-registry';
import { flattenValues, getNestedValue } from './validation-values';
/** Private evaluator; legacy operands bypass canonical validation. @internal */
export function evaluateField(
  value: unknown,
  rulesStr: string,
  allValues: Record<string, unknown> = {},
): FieldValidation {
  if (!rulesStr) return { valid: true, error: null };
  const rules = parseRules(rulesStr);
  for (const { name, param } of rules) {
    const ruleFn = builtinRules[name] || customRules.get(name);
    if (!ruleFn) {
      logger.warn(`[Zenith Form] Unknown validation rule: "${name}"`);
      continue;
    }
    const result = ruleFn(value, allValues, param);
    if (!result.valid) return result;
  }
  return { valid: true, error: null };
}

/**
 * اعتبارسنجی async یک فیلد (برای rules مثل uniqueness).
 *
 * FEATURE (v1.0.0): پشتیبانی از AbortSignal برای لغو درخواست‌های قبلی.
 */
/** @internal */
export async function evaluateFieldAsync(
  value: unknown,
  rulesStr: string,
  allValues: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<FieldValidation> {
  if (!rulesStr) return { valid: true, error: null };
  const rules = parseRules(rulesStr);

  // First run sync rules.
  const syncResult = evaluateField(value, rulesStr, allValues);
  if (!syncResult.valid) return syncResult;

  // Then run async rules.
  for (const { name, param } of rules) {
    // Check if aborted.
    if (signal?.aborted) return { valid: true, error: null };

    const asyncFn = asyncRules.get(name);
    if (asyncFn) {
      const result = await asyncFn(value, allValues, param, signal);
      if (!result.valid) return result;
    }
  }

  return { valid: true, error: null };
}

/**
 * اعتبارسنجی کل فرم با پشتیبانی از nested fields (dot notation).
 *
 * FEATURE (v1.0.0): rules با کلیدهای dot notation پشتیبانی می‌شوند.
 * مثلاً { 'address.city': 'required', 'address.zip': 'required,min:5' }
 */
/** Private evaluator; legacy operands bypass canonical validation. @internal */
export function evaluateForm(
  values: Record<string, unknown>,
  rules: Record<string, string>,
): FormValidation {
  const fields: Record<string, FieldValidation> = {};

  // Flatten nested values for cross-field validation.
  const flatValues = flattenValues(values);

  for (const [fieldName, rulesStr] of Object.entries(rules)) {
    // Get value using dot notation.
    const value = getNestedValue(values, fieldName);
    // Use flat values for cross-field validation.
    fields[fieldName] = evaluateField(value, rulesStr, flatValues);
  }

  return { valid: Object.values(fields).every((f) => f.valid), fields };
}

/**
 * اعتبارسنجی async کل فرم.
 */
/** @internal */
export async function evaluateFormAsync(
  values: Record<string, unknown>,
  rules: Record<string, string>,
  signal?: AbortSignal,
): Promise<FormValidation> {
  const fields: Record<string, FieldValidation> = {};
  const flatValues = flattenValues(values);

  for (const [fieldName, rulesStr] of Object.entries(rules)) {
    if (signal?.aborted) break;

    const value = getNestedValue(values, fieldName);
    fields[fieldName] = await evaluateFieldAsync(value, rulesStr, flatValues, signal);
  }

  return { valid: Object.values(fields).every((f) => f.valid), fields };
}



/**
 * اجرای validation با lifecycle hooks.
 */
/** @internal */
export async function evaluateWithLifecycle(
  values: Record<string, unknown>,
  rules: Record<string, string>,
  lifecycle: FormValidationLifecycle,
  async: boolean = false,
): Promise<FormValidation> {
  // onBeforeValidate
  if (lifecycle.onBeforeValidate) {
    const shouldContinue = await lifecycle.onBeforeValidate(values);
    if (!shouldContinue) {
      return { valid: true, fields: {} };
    }
  }

  // Run validation
  const result = async ? await evaluateFormAsync(values, rules) : evaluateForm(values, rules);

  // onAfterValidate
  if (lifecycle.onAfterValidate) {
    lifecycle.onAfterValidate(result, values);
  }

  // onFieldError / onFormValid / onFormInvalid
  if (!result.valid) {
    const flatValues = flattenValues(values);
    if (lifecycle.onFieldError) {
      for (const [name, field] of Object.entries(result.fields)) {
        if (!field.valid && field.error) {
          lifecycle.onFieldError(name, field.error, flatValues);
        }
      }
    }
    if (lifecycle.onFormInvalid) {
      lifecycle.onFormInvalid(result, values);
    }
  } else {
    if (lifecycle.onFormValid) {
      lifecycle.onFormValid(values);
    }
  }

  return result;
}

// ── Schema System ──

