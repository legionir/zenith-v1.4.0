import { computed } from '@zenith/state';
import { developerError } from '@zenith/errors';
import { equalFormValue } from './form-value-equality';
import { createFormScope, createFormSignal, type FormScope } from './form-scope';
import { installFormAutosave } from './form-autosave';
import { createAdvancedValidation } from './form-advanced-validation';
import type { AdvancedFormOptions, AdvancedFormApi, FieldState, FieldArrayApi } from './form-types';
/** @public */
export function createAdvancedForm<T extends Record<string, unknown>>(
  options: AdvancedFormOptions<T>,
): AdvancedFormApi<T> {
  const scope = createFormScope();
  try { return scope.run(() => buildAdvancedForm(options, scope)); }
  catch (error) { scope.dispose(); throw error; }
}

function buildAdvancedForm<T extends Record<string, unknown>>(options: AdvancedFormOptions<T>, scope: FormScope): AdvancedFormApi<T> {
  const {
    initialValues,
    onSubmit,
    autoSave,
    validateOnChange = true,
    validateOnBlur = false,
  } = options;

  const values = createFormSignal<T>(scope, { ...initialValues });
  const errors = createFormSignal<Record<string, string | null>>(scope, {});
  const formError = createFormSignal<string | null>(scope, null);
  const submitting = createFormSignal(scope, false);
  const validating = createFormSignal(scope, false);
  const touchedFields = createFormSignal<Record<string, boolean>>(scope, {});
  const dirtyFields = createFormSignal<Record<string, boolean>>(scope, {});

  const touched = computed(() => Object.values(touchedFields.get()).some(Boolean));
  const dirty = computed(() => Object.values(dirtyFields.get()).some(Boolean));
  const valid = computed(() => {
    const err = errors.get();
    return Object.values(err).every((e) => e === null || e === undefined);
  });

  const validation = createAdvancedValidation(scope, options, { values, errors, formError, validating });
  let submitRun = 0;
  scope.onDispose(() => {
    submitRun++;
    submitting.set(false); validating.set(false);
  });
  installFormAutosave(scope, { values, formError, options: autoSave });

  function setFieldValue(name: string, value: unknown) {
    if (scope.disposed) return;
    const current = values.peek(), version = scope.version;
    const isDirty = !equalFormValue(value, initialValues[name]);
    if (scope.disposed || scope.version !== version || values.peek() !== current) return;
    scope.invalidate();
    const writeVersion = scope.version, updated = { ...current, [name]: value };
    values.set(updated);
    if (scope.disposed || scope.version !== writeVersion || values.peek() !== updated) return;
    dirtyFields.set({ ...dirtyFields.peek(), [name]: isDirty });
    if (scope.disposed || scope.version !== writeVersion || values.peek() !== updated) return;

    if (validateOnChange && !validateOnBlur) {
      validation.checkInBackground(name);
    }
  }

  function setFieldError(name: string, error: string | null) {
    if (scope.disposed) return;
    validation.supersedeField(name);
    errors.set({ ...errors.peek(), [name]: error });
  }

  function setFieldTouched(name: string, isTouched = true) {
    if (scope.disposed) return;
    const version = scope.version, snapshot = values.peek();
    touchedFields.set({ ...touchedFields.peek(), [name]: isTouched });
    if (scope.disposed || scope.version !== version || values.peek() !== snapshot) return;
    if (validateOnBlur && isTouched) {
      validation.checkInBackground(name);
    }
  }

  function getField<K extends keyof T>(name: K): FieldState<T[K]> {
    const nameStr = String(name);
    return {
      value: computed(() => values.get()[name]),
      error: computed(() => errors.get()[nameStr] || null),
      touched: computed(() => !!touchedFields.get()[nameStr]),
      dirty: computed(() => !!dirtyFields.get()[nameStr]),
      validating,
    };
  }

  function getNested<K = unknown>(path: string): FieldState<K> {
    const getNestedValue = (obj: unknown, p: string): unknown => {
      return p.split('.').reduce<unknown>((acc, key) => acc == null ? undefined : Reflect.get(Object(acc), key), obj);
    };

    return {
      value: computed(() => getNestedValue(values.get(), path) as K),
      error: computed(() => errors.get()[path] || null),
      touched: computed(() => !!touchedFields.get()[path]),
      dirty: computed(() => !!dirtyFields.get()[path]),
      validating,
    };
  }

  function getFieldArray<K = unknown>(path: string): FieldArrayApi<K> {
    const getArray = (tracked = false): K[] => {
      const v = tracked ? values.get() : values.peek();
      const value: unknown = v[path];
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) throw developerError(`Form array "${path}" requires an array value`);
      // Array shape is checked; K remains caller-declared, not item decoding.
      return value as K[];
    };

    const setArray = (newArr: K[]) => {
      if (scope.disposed) return;
      const current = values.peek(), version = scope.version;
      const isDirty = !equalFormValue(newArr, initialValues[path]);
      if (scope.disposed || scope.version !== version || values.peek() !== current) return;
      scope.invalidate();
      const writeVersion = scope.version, updated = { ...current, [path]: newArr };
      values.set(updated);
      if (scope.disposed || scope.version !== writeVersion || values.peek() !== updated) return;
      dirtyFields.set({ ...dirtyFields.peek(), [path]: isDirty });
    };

    const items = computed(() => getArray(true));
    const length = computed(() => getArray(true).length);

    return {
      items,
      length,
      push: (item) => setArray([...getArray(), item]),
      insert: (index, item) => {
        const arr = [...getArray()];
        arr.splice(index, 0, item);
        setArray(arr);
      },
      remove: (index) => {
        const arr = [...getArray()];
        arr.splice(index, 1);
        setArray(arr);
      },
      move: (from, to) => {
        const arr = [...getArray()];
        const removed = arr.splice(from, 1);
        if (removed.length === 0) return;
        arr.splice(to, 0, ...removed);
        setArray(arr);
      },
      swap: (a, b) => {
        const arr = [...getArray()];
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= arr.length || b >= arr.length) return;
        const first = arr.slice(a, a + 1), second = arr.slice(b, b + 1);
        arr.splice(a, 1, ...second); arr.splice(b, 1, ...first);
        setArray(arr);
      },
      clear: () => setArray([]),
    };
  }

  async function submit() {
    if (scope.disposed) return;
    const run = ++submitRun, snapshot = values.peek(), version = scope.version;
    const current = () => !scope.disposed && submitRun === run && scope.version === version && values.peek() === snapshot;
    try {
      if (!await validation.validateAll() || !current()) return;
      submitting.set(true);
      formError.set(null);
      await onSubmit?.(snapshot);
    } catch (error) {
      if (current()) formError.set(error instanceof Error ? error.message : 'Submission failed');
      throw error;
    } finally {
      if (!scope.disposed && run === submitRun) submitting.set(false);
    }
  }

  function reset(newValues?: T) {
    if (scope.disposed) return;
    scope.invalidate(); validation.invalidate(); submitRun++;
    submitting.set(false); validating.set(false);
    values.set(newValues ? { ...newValues } : { ...initialValues });
    errors.set({});
    formError.set(null);
    touchedFields.set({});
    dirtyFields.set({});
  }

  return {
    values,
    errors,
    formError,
    submitting,
    validating,
    touched,
    dirty,
    valid,
    field: name => scope.run(() => getField(name)),
    nested: <K = unknown>(path: string) => scope.run(() => getNested<K>(path)),
    array: <K = unknown>(path: string) => scope.run(() => getFieldArray<K>(path)),
    setFieldValue,
    setFieldError,
    setFieldTouched,
    validate: validation.validateAll,
    validateField: validation.checkField,
    reset,
    submit,
    startSubmit: () => { if (!scope.disposed) submitting.set(true); },
    endSubmit: () => { if (!scope.disposed) submitting.set(false); },
    dispose: () => scope.dispose(),
  };
}

