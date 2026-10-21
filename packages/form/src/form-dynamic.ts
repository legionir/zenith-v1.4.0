import { validateField } from './validation-engine';
import type { FormStoreState, FormFieldState } from './form-types';
import type { AddFormFieldOptions } from './validation-types';
/** Dynamic state construction, not a fabricated FormStore instance. @internal */
export function createAddedFieldState(state: FormStoreState, options: AddFormFieldOptions): FormStoreState {
  const { name, initial, rules } = options;
  return {
    ...state,
    fields: { ...state.fields, [name]: {
      value: initial, touched: false, dirty: false,
      validation: validateField(initial, { rules: rules || '' }), validating: false,
    } },
    valid: Object.values(state.fields).every((field: FormFieldState) => field.validation.valid) && validateField(initial, { rules: rules || '' }).valid,
  };
}

/** Aggregate flags after the owner updates or removes its field records. @internal */
export function withFieldSummary(state: FormStoreState, fields: Record<string, FormFieldState>): FormStoreState {
  return { ...state, fields,
    valid: Object.values(fields).every(field => field.validation.valid),
    dirty: Object.values(fields).some(field => field.dirty),
  };
}
