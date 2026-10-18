import { FormStore } from './form-store';
import { createAdvancedForm } from './form-advanced';
import { createWizardForm } from './form-wizard';
import { dynamicFormFactoryOptions } from './form-factory-options';
import type { FormOptions, WizardStep, WizardFormApi, AdvancedFormApi, AdvancedFormOptions, FormFieldDefinitions } from './form-types';

type DynamicValues = Record<string, unknown>;
type Ready<T extends DynamicValues> = FormOptions<T> & { initialValues: T };
type Empty = FormOptions<DynamicValues> & { initialValues?: undefined };
// Keep the historical routing keys in one place. This is dispatch, not proof of
// a decoded payload/callback contract. Dynamic field maps have a union return.
const optionKeys = ['initialValues', 'steps', 'validate', 'validation', 'schema', 'rules', 'onSubmit'] as const;
function hasOptions(value: object): boolean { return optionKeys.some(key => key in value); }

/** @public */
export function createForm<T extends Record<string, unknown>>(options: FormOptions<T> & { initialValues: T; steps: WizardStep[] }): WizardFormApi<T>;
/** Without initial values the wizard has a dynamic unknown-valued record. @public */
export function createForm(options: FormOptions<Record<string, unknown>> & { initialValues?: undefined; steps: WizardStep[] }): WizardFormApi<Record<string, unknown>>;
/** @public */
export function createForm<T extends Record<string, unknown>>(options: FormOptions<T> & { initialValues: T }): AdvancedFormApi<T>;
/** An explicit absent initial record starts a dynamic advanced form. @public */
export function createForm(options: FormOptions<Record<string, unknown>> & { initialValues: undefined }): AdvancedFormApi<Record<string, unknown>>;
/** Statically unambiguous field maps retain the concrete Store return. @public */
export function createForm<F extends FormFieldDefinitions>(fields: F & (string extends keyof F ? never : Extract<keyof F, 'initialValues' | 'steps' | 'validate' | 'validation' | 'schema' | 'rules' | 'onSubmit'> extends never ? unknown : never)): FormStore;
/** Runtime field names can collide with legacy routing keys; narrow before use. @public */
export function createForm(fields: FormFieldDefinitions): FormStore | AdvancedFormApi<Record<string, unknown>> | WizardFormApi<Record<string, unknown>>;
export function createForm<T extends DynamicValues>(input: Ready<T> | Empty | FormFieldDefinitions): FormStore | AdvancedFormApi<T> | WizardFormApi<T> | AdvancedFormApi<DynamicValues> | WizardFormApi<DynamicValues> {
  if (!hasOptions(input)) return new FormStore(input as FormFieldDefinitions);
  // Ready options have a concrete caller-declared T. No invented empty T is
  // ever passed to a typed callback. Native JS config failures reject below.
  if ('initialValues' in input && input.initialValues !== undefined) {
    const options = input as Ready<T>;
    if (Array.isArray(options.steps)) return createWizardForm({ ...options, steps: options.steps });
    return createAdvancedForm(options);
  }
  const options = dynamicFormFactoryOptions.resolve(input);
  const initialized: AdvancedFormOptions<DynamicValues> = { ...options, initialValues: {} };
  // Empty steps still return the Wizard API promised by the overload.
  if (Array.isArray(options.steps)) return createWizardForm({ ...initialized, steps: options.steps });
  return createAdvancedForm(initialized);
}
