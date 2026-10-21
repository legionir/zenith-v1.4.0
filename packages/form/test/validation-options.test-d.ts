import { expectTypeOf } from 'vitest';
import { FormStore, validateField, validateFieldAsync, validateFormAsync, validateWithLifecycle, type FieldValidation, type FormValidation, type FieldValidationOptions, type AddFormFieldOptions } from '../src';
const options: FieldValidationOptions = { rules: 'required', allValues: { password: 'opaque' } };
expectTypeOf(validateField('x', options)).toEqualTypeOf<FieldValidation>();
expectTypeOf(validateFieldAsync('x', options)).toEqualTypeOf<Promise<FieldValidation>>();
expectTypeOf(validateFormAsync({ values: {}, rules: {} })).toEqualTypeOf<Promise<FormValidation>>();
expectTypeOf(validateWithLifecycle({}, { rules: {}, lifecycle: {} })).toEqualTypeOf<Promise<FormValidation>>();
expectTypeOf<AddFormFieldOptions['initial']>().toEqualTypeOf<unknown>();
declare const form: FormStore;
form.moveItem('items', { from: 0, to: 1 }); form.addField({ name: 'payload', initial: undefined });
// @ts-expect-error Rules are configuration strings, not untyped data.
validateField('x', { rules: 1 });
// @ts-expect-error Canonical async signals must have AbortSignal capabilities.
validateFieldAsync('x', { rules: '', signal: { aborted: true } });
// @ts-expect-error Index configuration is numeric.
form.moveItem('items', { from: '0', to: 1 });
