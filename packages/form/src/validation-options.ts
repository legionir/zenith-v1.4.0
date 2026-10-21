import { defineOptions, s } from '@zenith/schema';
import type { FieldValidationOptions, AsyncFieldValidationOptions, AsyncFormValidationOptions, LifecycleValidationOptions, FormValidationLifecycle, MoveFormItemOptions, AddFormFieldOptions } from './validation-types';
// Record/callback/abort checks describe consumed capabilities, not payload or
// callback-result decoding. These custom leaves keep caller object identity.
const record = s.custom<Record<string, unknown>>(value => value !== null && typeof value === 'object' && !Array.isArray(value), 'values record');
const abort = s.custom<AbortSignal>(value => value !== null && typeof value === 'object' && typeof Reflect.get(value, 'aborted') === 'boolean' && typeof Reflect.get(value, 'addEventListener') === 'function' && typeof Reflect.get(value, 'removeEventListener') === 'function', 'AbortSignal capability');
const lifecycle = s.custom<FormValidationLifecycle>(value => value !== null && typeof value === 'object' && ['onBeforeValidate', 'onAfterValidate', 'onFieldChange', 'onFieldError', 'onFormValid', 'onFormInvalid'].every(key => { const hook: unknown = Reflect.get(value, key); return hook === undefined || typeof hook === 'function'; }), 'validation lifecycle callbacks');
/** @internal */
export const fieldValidationOptions = /* @__PURE__ */ defineOptions<FieldValidationOptions>('FieldValidationOptions', s.object({ rules: s.string(), allValues: s.optional(record) }));
/** @internal */
export const asyncFieldValidationOptions = /* @__PURE__ */ defineOptions<AsyncFieldValidationOptions>('AsyncFieldValidationOptions', s.object({ rules: s.string(), allValues: s.optional(record), signal: s.optional(abort) }));
/** @internal */
export const asyncFormValidationOptions = /* @__PURE__ */ defineOptions<AsyncFormValidationOptions>('AsyncFormValidationOptions', s.object({ values: record, rules: s.record(s.string()), signal: s.optional(abort) }));
/** @internal */
export const lifecycleValidationOptions = /* @__PURE__ */ defineOptions<LifecycleValidationOptions>('LifecycleValidationOptions', s.object({ rules: s.record(s.string()), lifecycle, async: s.optional(s.boolean()) }));
/** @internal */
export const moveFormItemOptions = /* @__PURE__ */ defineOptions<MoveFormItemOptions>('MoveFormItemOptions', s.object({ from: s.number({ int: true, min: 0 }), to: s.number({ int: true, min: 0 }) }));
/** @internal */
export const addFormFieldOptions = /* @__PURE__ */ defineOptions<AddFormFieldOptions>('AddFormFieldOptions', s.object({ name: s.string(), initial: s.default(s.custom<unknown>(() => true, 'initial value'), undefined), rules: s.optional(s.string()) }));
