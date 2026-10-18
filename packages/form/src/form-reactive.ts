import { createFormScope, createFormSignal } from './form-scope';
import type { FormOptions, ReactiveFormApi } from './form-types';

/** With an actual initial object, retain its known field contract. @public */
export function createReactiveForm<T extends Record<string, unknown>>(options: FormOptions<T> & { initialValues: T }): ReactiveFormApi<T>;
/** Optional initial data cannot promise that all fields of T actually exist. @public */
export function createReactiveForm<T extends Record<string, unknown>>(options: FormOptions<T>): ReactiveFormApi<T | Record<string, unknown>>;
export function createReactiveForm<T extends Record<string, unknown>>(options: FormOptions<T>): ReactiveFormApi<T | Record<string, unknown>> {
  const scope = createFormScope();
  try {
    return scope.run(() => {
      // Preserve supplied payload identity. An empty default is a real dynamic
      // record, not a cast pretending to contain all fields of an absent T.
      const initial: T | Record<string, unknown> = options.initialValues || {};
      const values = createFormSignal(scope, initial);
      const errors = createFormSignal<Record<string, string>>(scope, {});
      const submitting = createFormSignal(scope, false);
      scope.onDispose(() => submitting.set(false));
      async function startSubmit(): Promise<void> {
        if (scope.disposed) return;
        submitting.set(true);
        if (!scope.disposed) errors.set({});
      }
      async function endSubmit(): Promise<void> {
        if (!scope.disposed) submitting.set(false);
      }
      return { values, errors, submitting, startSubmit, endSubmit, dispose: () => scope.dispose() };
    });
  } catch (error) { scope.dispose(); throw error; }
}
