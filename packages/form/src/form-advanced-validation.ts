import { schemaFieldError } from './form-schema-error';
import { validateFieldAsync } from './validator';
import type { Signal } from '@zenith/state';
import type { AdvancedFormOptions } from './form-types';
import type { FormScope } from './form-scope';

async function evaluateField<T extends Record<string, unknown>, K extends keyof T>(key: K, currentValues: T, options: AdvancedFormOptions<T>): Promise<string | null> {
  const { schema, rules: stringRules, validation: ruleValidation, validate } = options;
  const name = String(key);
  const fieldValue = currentValues[key];

  if (schema) {
    const result = schema.safeParse(currentValues);
    if (result.success === false && result.error) {
      const fieldError = schemaFieldError(result.error, name);
      if (fieldError) {
        const msg = fieldError;
        return msg;
      }
    } else if (result.ok === false && Array.isArray(result.issues)) {
      const issue = result.issues.find((i) => i.path === name || i.path?.startsWith(`${name}.`));
      if (issue) {
        const msg = issue.message || 'Invalid value';
        return msg;
      }
    }
  }

  const strRule = stringRules?.[key];
  if (strRule) {
    const normalizedRule = strRule.replace(/\|/g, ',');
    const res = await validateFieldAsync(fieldValue, { rules: normalizedRule, allValues: currentValues });
    if (!res.valid) {
      const msg = res.error || 'Invalid value';
      return msg;
    }
  }

  const ruleDefs = ruleValidation?.[key];
  if (ruleDefs) {
    const list = Array.isArray(ruleDefs) ? ruleDefs : [ruleDefs];
    for (const r of list) {
      const outcome = await r.validate(fieldValue);
      if (outcome === false) {
        const msg = r.message || 'Invalid value';
        return msg;
      }
      if (typeof outcome === 'string') {
        return outcome;
      }
    }
  }

  const fieldValidators = validate?.[key];
  if (fieldValidators) {
    const validators = Array.isArray(fieldValidators) ? fieldValidators : [fieldValidators];
    for (const validator of validators) {
      const result = await validator(fieldValue, currentValues);
      if (result === false) {
        const msg = 'Invalid value';
        return msg;
      }
      if (typeof result === 'string') {
        return result;
      }
    }
  }

  return null;
}

/** Snapshot/field-generation leases gate writes, never decode validator results. @internal */
export function createAdvancedValidation<T extends Record<string, unknown>>(scope: FormScope, options: AdvancedFormOptions<T>, state: { values: Signal<T>; errors: Signal<Record<string, string | null>>; formError: Signal<string | null>; validating: Signal<boolean> }) {
  const { values, errors, formError, validating } = state;
  const generations = new Map<string, number>();
  let validationRun = 0;
  function begin(name: string) {
    const snapshot = values.peek(), version = scope.version;
    const generation = (generations.get(name) ?? 0) + 1;
    generations.set(name, generation);
    const current = () => !scope.disposed && scope.version === version && values.peek() === snapshot && generations.get(name) === generation;
    const result = evaluateField(name as keyof T, snapshot, options).then(error => {
      if (current()) errors.set({ ...errors.peek(), [name]: error });
      return error;
    });
    return { result, current };
  }
  function checkField(name: string): Promise<string | null> {
    if (scope.disposed) return Promise.resolve(null);
    return begin(name).result;
  }
  async function validateAll(): Promise<boolean> {
    if (scope.disposed) return false;
    const run = ++validationRun, snapshot = values.peek(), version = scope.version;
    const current = () => !scope.disposed && run === validationRun && scope.version === version && values.peek() === snapshot;
    validating.set(true);
    try {
      const fields = Object.keys({ ...options.initialValues, ...options.rules, ...options.validation, ...options.validate, ...snapshot }).map(begin);
      const results = await Promise.all(fields.map(field => field.result));
      const accepted = () => current() && fields.every(field => field.current());
      if (!accepted()) return false;
      if (options.validateForm) {
        const result = await options.validateForm(snapshot);
        if (!accepted()) return false;
        if (result === false || typeof result === 'string') {
          formError.set(typeof result === 'string' ? result : 'Form is invalid');
          return false;
        }
      }
      formError.set(null);
      return results.every(result => result === null);
    } finally {
      if (!scope.disposed && run === validationRun) validating.set(false);
    }
  }
  function checkInBackground(name: string): void {
    if (scope.disposed) return;
    const field = begin(name);
    void field.result.catch(error => {
      if (field.current()) formError.set(error instanceof Error ? error.message : 'Validation failed');
    });
  }
  function supersedeField(name: string): void { generations.set(name, (generations.get(name) ?? 0) + 1); }
  function invalidate(): void { validationRun++; generations.clear(); }
  scope.onDispose(invalidate);
  return { checkField, checkInBackground, validateAll, invalidate, supersedeField };
}
