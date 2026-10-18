import { deprecate } from '@zenith/errors';
import type { FieldValidation, FormValidation, FieldValidationOptions, AsyncFieldValidationOptions, AsyncFormValidationOptions, FormValidationLifecycle, LifecycleValidationOptions } from './validation-types';
import { fieldValidationOptions, asyncFieldValidationOptions, asyncFormValidationOptions, lifecycleValidationOptions } from './validation-options';
import { evaluateField, evaluateFieldAsync, evaluateForm, evaluateFormAsync, evaluateWithLifecycle } from './validation-evaluate';
export type { FormValidationLifecycle } from './validation-types';

/** @public */
export function validateField(value: unknown, options: FieldValidationOptions): FieldValidation;
/** @public @deprecated Use validateField(value, { rules, allValues }) (ZEN-DEPR-095; removal in 2.0). */
export function validateField(value: unknown, rules: string, allValues?: Record<string, unknown>): FieldValidation;
export function validateField(value: unknown, optionsOrRules: FieldValidationOptions | string, legacyValues: Record<string, unknown> = {}): FieldValidation {
  if (typeof optionsOrRules !== 'object' || optionsOrRules === null || arguments.length > 2) {
    deprecate('ZEN-DEPR-095', 'validateField(value, rules, allValues)', 'validateField(value, { rules, allValues })');
    return evaluateField(value, optionsOrRules as string, legacyValues);
  }
  const { rules, allValues = {} } = fieldValidationOptions.resolve(optionsOrRules);
  return evaluateField(value, rules, allValues);
}

/** @public */
export function validateFieldAsync(value: unknown, options: AsyncFieldValidationOptions): Promise<FieldValidation>;
/** @public @deprecated Use validateFieldAsync(value, { rules, allValues, signal }) (ZEN-DEPR-096; removal in 2.0). */
export function validateFieldAsync(value: unknown, rules: string, allValues?: Record<string, unknown>, signal?: AbortSignal): Promise<FieldValidation>;
export function validateFieldAsync(value: unknown, optionsOrRules: AsyncFieldValidationOptions | string, legacyValues: Record<string, unknown> = {}, legacySignal?: AbortSignal): Promise<FieldValidation> {
  try {
    if (typeof optionsOrRules !== 'object' || optionsOrRules === null || arguments.length > 2) {
      deprecate('ZEN-DEPR-096', 'validateFieldAsync(value, rules, allValues, signal)', 'validateFieldAsync(value, { rules, allValues, signal })');
      return evaluateFieldAsync(value, optionsOrRules as string, legacyValues, legacySignal);
    }
    const { rules, allValues = {}, signal } = asyncFieldValidationOptions.resolve(optionsOrRules);
    return evaluateFieldAsync(value, rules, allValues, signal);
  } catch (error) { return Promise.reject(error); }
}

/** Values and rule-map operands retain their existing two-argument contract. @public */
export function validateForm(values: Record<string, unknown>, rules: Record<string, string>): FormValidation {
  return evaluateForm(values, rules);
}

/** @public */
export function validateFormAsync(options: AsyncFormValidationOptions): Promise<FormValidation>;
/** @public @deprecated Use validateFormAsync({ values, rules, signal }) (ZEN-DEPR-097; removal in 2.0). */
export function validateFormAsync(values: Record<string, unknown>, rules: Record<string, string>, signal?: AbortSignal): Promise<FormValidation>;
export function validateFormAsync(optionsOrValues: AsyncFormValidationOptions | Record<string, unknown>, legacyRules?: Record<string, string>, legacySignal?: AbortSignal): Promise<FormValidation> {
  try {
    if (arguments.length > 1) {
      deprecate('ZEN-DEPR-097', 'validateFormAsync(values, rules, signal)', 'validateFormAsync({ values, rules, signal })');
      return evaluateFormAsync(optionsOrValues as Record<string, unknown>, legacyRules!, legacySignal);
    }
    const { values, rules, signal } = asyncFormValidationOptions.resolve(optionsOrValues);
    return evaluateFormAsync(values, rules, signal);
  } catch (error) { return Promise.reject(error); }
}

/** @public */
export function validateWithLifecycle(values: Record<string, unknown>, options: LifecycleValidationOptions): Promise<FormValidation>;
/** @public @deprecated Use validateWithLifecycle(values, { rules, lifecycle, async }) (ZEN-DEPR-098; removal in 2.0). */
export function validateWithLifecycle(values: Record<string, unknown>, rules: Record<string, string>, lifecycle: FormValidationLifecycle, async?: boolean): Promise<FormValidation>;
export function validateWithLifecycle(values: Record<string, unknown>, optionsOrRules: LifecycleValidationOptions | Record<string, string>, legacyLifecycle?: FormValidationLifecycle, legacyAsync = false): Promise<FormValidation> {
  try {
    if (arguments.length > 2) {
      deprecate('ZEN-DEPR-098', 'validateWithLifecycle(values, rules, lifecycle, async)', 'validateWithLifecycle(values, { rules, lifecycle, async })');
      return evaluateWithLifecycle(values, optionsOrRules as Record<string, string>, legacyLifecycle!, legacyAsync);
    }
    const { rules, lifecycle, async = false } = lifecycleValidationOptions.resolve(optionsOrRules);
    return evaluateWithLifecycle(values, rules, lifecycle, async);
  } catch (error) { return Promise.reject(error); }
}
