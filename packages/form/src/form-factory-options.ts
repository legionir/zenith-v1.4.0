import { defineOptions, s } from '@zenith/schema';
import type { FormOptions, Validator, ValidationRule, WizardStep } from './form-types';

type Values = Record<string, unknown>;
type Options = FormOptions<Values>;
// These leaves verify consumed configuration/callability and preserve native
// callback/receiver identity. They do not decode callback outputs or field data.
const callable = (value: unknown) => typeof value === 'function';
const validator = s.custom<Validator<unknown, Values>>(callable, 'field validator callback');
const rule = s.custom<ValidationRule>(value => value !== null && typeof value === 'object' && callable(Reflect.get(value, 'validate')) && (Reflect.get(value, 'message') === undefined || typeof Reflect.get(value, 'message') === 'string'), 'validation rule');
const step = s.custom<WizardStep>(value => {
  if (value === null || typeof value !== 'object') return false;
  const fields: unknown = Reflect.get(value, 'fields'), validate: unknown = Reflect.get(value, 'validate');
  return typeof Reflect.get(value, 'id') === 'string' && typeof Reflect.get(value, 'title') === 'string' && Array.isArray(fields) && fields.every((field: unknown) => typeof field === 'string') && (validate === undefined || callable(validate));
}, 'wizard step');
const schema = s.custom<NonNullable<Options['schema']>>(value => value !== null && typeof value === 'object' && callable(Reflect.get(value, 'parse')) && callable(Reflect.get(value, 'safeParse')), 'schema parse/safeParse capabilities');
const autoSave = s.custom<NonNullable<Options['autoSave']>>(value => {
  if (value === null || typeof value !== 'object') return false;
  const interval: unknown = Reflect.get(value, 'interval');
  return typeof Reflect.get(value, 'enabled') === 'boolean' && callable(Reflect.get(value, 'handler')) && (interval === undefined || (typeof interval === 'number' && Number.isFinite(interval) && interval >= 0));
}, 'autosave configuration');
/** Missing-initial legacy config has unknown values, never a fabricated T. @internal */
export const dynamicFormFactoryOptions = /* @__PURE__ */ defineOptions<Options>('DynamicFormFactoryOptions', s.object({
  initialValues: s.optional(s.custom<undefined>(value => value === undefined, 'absent initial values')),
  rules: s.optional(s.record(s.string())),
  validation: s.optional(s.record(s.union([rule, s.array(rule)]))),
  validate: s.optional(s.record(s.union([validator, s.array(validator)]))),
  validateForm: s.optional(s.custom<NonNullable<Options['validateForm']>>(callable, 'form validator callback')),
  schema: s.optional(schema),
  steps: s.optional(s.array(step)),
  onSubmit: s.optional(s.custom<NonNullable<Options['onSubmit']>>(callable, 'submit callback')),
  autoSave: s.optional(autoSave),
  validateOnChange: s.optional(s.boolean()),
  validateOnBlur: s.optional(s.boolean()),
}));
