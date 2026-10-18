import { validateField } from './validator';
import type { FormValidation } from './validation-types';
import type { FormFieldState, FormStoreState } from './form-types';
/** Reset construction is kept separate from timer/abort ownership. @internal */
export function createResetState(initialValues: Record<string, unknown>, rules: Record<string, string>): FormStoreState {
    const fieldStates: Record<string, FormFieldState> = {};
    for (const [name, initial] of Object.entries(initialValues)) {
      fieldStates[name] = {
        value: initial,
        touched: false,
        dirty: false,
        validation: validateField(initial, { rules: rules[name] || '' }),
        validating: false,
      };
    }
    return {
      fields: fieldStates,
      submitting: false,
      submitted: false,
      valid: Object.values(fieldStates).every((f: FormFieldState) => f.validation.valid),
      dirty: false,
      formError: null,
      validating: false,
    };
}

export function readFormValues(state: FormStoreState): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][])
      values[k] = v.value;
    return values;
  }

/** Copy field flags without changing values or validation ownership. @internal */
export function touchFormState(state: FormStoreState): FormStoreState {
    const newFields: Record<string, FormFieldState> = {};
    for (const [k, v] of Object.entries(state.fields)) {
      newFields[k] = { ...v, touched: true };
    }
    return { ...state, fields: newFields };
}

/** Preserve no-op identity when a field is absent or already touched. @internal */
export function touchFieldState(state: FormStoreState, name: string): FormStoreState {
  const field = state.fields[name];
  if (!field || field.touched) return state;
  return { ...state, fields: { ...state.fields, [name]: { ...field, touched: true } } };
}

/** Invalidate pending flags together with the validation lease, without payload cloning. @internal */
export function idleFormValidation(state: FormStoreState): FormStoreState {
  const fields: Record<string, FormFieldState> = {};
  for (const [name, field] of Object.entries(state.fields)) fields[name] = field.validating ? { ...field, validating: false } : field;
  return { ...state, fields, validating: false };
}

/** Report the stored validation snapshot without invoking disposed validators. @internal */
export function readFormValidation(state: FormStoreState): FormValidation {
  const fields: FormValidation['fields'] = {};
  for (const [name, field] of Object.entries(state.fields)) fields[name] = field.validation;
  return { valid: state.valid, fields };
}
