// Compatibility facade; registry ownership and evaluation order remain explicit.
export type { FieldValidation, FormValidation, FieldValidationRule, AsyncFieldValidationRule } from './validation-types';
export { defineRule, defineAsyncRule, clearCustomRules } from './validation-registry';
export { getNestedValue, setNestedValue, flattenValues } from './validation-values';
export { validateField, validateFieldAsync, validateForm, validateFormAsync, validateWithLifecycle, type FormValidationLifecycle } from './validation-engine';
export { schemaToFormConfig, schemaToHtml, type SchemaField, type FormSchema } from './validation-html';

export type { FieldValidationOptions, AsyncFieldValidationOptions, AsyncFormValidationOptions, LifecycleValidationOptions, MoveFormItemOptions, AddFormFieldOptions } from './validation-types';
