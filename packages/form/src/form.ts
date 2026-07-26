// packages/form/src/form.ts
//
// Form Runtime — Phase 7 Advanced.
//
// قابلیت‌های جدید:
//   - Async validation (validateAsync)
//   - Cross-field validation (via equalsField and custom rules with allValues)
//   - Form Arrays (addField, removeField, moveField)
//   - Dynamic fields (addField, removeField for non-array)
//   - Batch validation (validate all at once)
//   - Async submit handler
//   - Simple reactive form API (v1.4.0)

import { signal, effect, type Signal } from '@zenith/state';

/**
 * Form validation rule.
 */
export interface ValidationRule {
  validate: (value: any) => boolean | string | Promise<boolean | string>;
  message?: string;
}

/**
 * Simple reactive form options.
 */
export interface FormOptions<T extends Record<string, any>> {
  initialValues?: T;
  validation?: Partial<Record<keyof T, ValidationRule | ValidationRule[]>>;
  onSubmit?: (values: T) => void | Promise<void>;
}

/**
 * Create a simple reactive form.
 *
 * @example
 * const form = createForm({
 *   initialValues: { username: '', password: '' },
 *   validation: {
 *     username: { validate: v => v.length > 3, message: 'Min 4 chars' }
 *   }
 * });
 */
export function createReactiveForm<T extends Record<string, any>>(options: FormOptions<T>) {
  const values = signal<T>(options.initialValues || ({} as T));
  const errors = signal<Record<string, string>>({});
  const submitting = signal(false);

  async function startSubmit() {
    submitting.set(true);
    errors.set({});
  }

  async function endSubmit() {
    submitting.set(false);
  }

  return { values, errors, submitting, startSubmit, endSubmit };
}
import { validateField, validateFieldAsync, validateForm, validateFormAsync, type FieldValidation, type FormValidation } from './validator';

export interface FormFieldState {
  value: any;
  touched: boolean;
  dirty: boolean;
  validation: FieldValidation;
  /** آیا در حال async validation است؟ */
  validating: boolean;
}

export interface FormStoreState {
  fields: Record<string, FormFieldState>;
  submitting: boolean;
  submitted: boolean;
  valid: boolean;
  dirty: boolean;
  /** خطای سطح فرم (نه فیلد). */
  formError: string | null;
  /** آیا در حال async validation کل فرم است؟ */
  validating: boolean;
}

export class FormStore {
  private _signal: Signal<FormStoreState>;
  private _initialValues: Record<string, any>;
  private _rules: Record<string, string>;
  private _asyncValidationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // FIX (BUG-FRM-02): generation counter برای جلوگیری از race condition در async validation.
  private _validationGeneration = 0;
  // FIX (BUG-FRM-05): per-field debounce (پیش‌فرض ۳۰۰ms).
  private _fieldDebounce = new Map<string, number>();
  private static readonly DEFAULT_DEBOUNCE_MS = 300;
  // FIX (v1.2.3): AbortController برای لغو in-flight async validation هنگام
  // destroy(). قبلاً destroy فقط تایمرهای pending را پاک می‌کرد ولی درخواست‌های
  // async validation در حال انجام (مثل fetch به سرور) ادامه پیدا می‌کردند و
  // پس از تکمیل، state از بین رفته را mutate می‌کردند (zombie callback).
  private _abortController: AbortController = new AbortController();

  constructor(fields: Record<string, { initial: any; rules?: string }>) {
    this._initialValues = {};
    this._rules = {};
    const fieldStates: Record<string, FormFieldState> = {};

    for (const [name, config] of Object.entries(fields)) {
      this._initialValues[name] = config.initial;
      this._rules[name] = config.rules || '';
      fieldStates[name] = {
        value: config.initial,
        touched: false,
        dirty: false,
        validation: validateField(config.initial, config.rules || ''),
        validating: false,
      };
    }

    this._signal = signal<FormStoreState>({
      fields: fieldStates,
      submitting: false,
      submitted: false,
      valid: Object.values(fieldStates).every((f: FormFieldState) => f.validation.valid),
      dirty: false,
      formError: null,
      validating: false,
    });
  }

  get signal(): Signal<FormStoreState> { return this._signal; }

  getValue(name: string): any { return this._signal.get().fields[name]?.value; }

  setValue(name: string, value: any): void {
    this._updateField(name, value, false);
    // Trigger async validation with debounce.
    this._debouncedAsyncValidate(name);
  }

  /** SetValue + touch + immediate sync validation. */
  setValueAndTouch(name: string, value: any): void {
    this._updateField(name, value, true);
    this._debouncedAsyncValidate(name);
  }

  private _updateField(name: string, value: any, touch: boolean): void {
    const state = this._signal.get();
    const field = state.fields[name];
    if (!field) return;

    const allValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][]) allValues[k] = v.value;

    const validation = validateField(value, this._rules[name] || '', allValues);

    const newFields = {
      ...state.fields,
      [name]: {
        ...field,
        value,
        touched: touch ? true : field.touched,
        dirty: value !== this._initialValues[name],
        validation,
      },
    };

    // Cross-field validation: re-validate fields that have equalsField referencing this field.
    // FIX (v1.2.3): قبلاً فقط equalsField بررسی می‌شد. حالا differentFrom و
    // requiresField هم چک می‌شوند تا cross-field re-validation کامل باشد.
    for (const [otherName, otherField] of Object.entries(newFields) as [string, FormFieldState][]) {
      if (otherName === name) continue;
      const otherRules = this._rules[otherName] || '';
      if (otherRules.includes('equalsField') ||
          otherRules.includes('differentFrom') ||
          otherRules.includes('requiresField')) {
        const newAllValues: Record<string, any> = {};
        for (const [k, v] of Object.entries(newFields) as [string, FormFieldState][]) newAllValues[k] = v.value;
        newFields[otherName] = {
          ...otherField,
          validation: validateField(otherField.value, otherRules, newAllValues),
        };
      }
    }

    this._signal.set({
      ...state,
      fields: newFields,
      valid: Object.values(newFields).every((f: FormFieldState) => f.validation.valid),
      dirty: Object.values(newFields).some((f: FormFieldState) => f.dirty),
    });
  }

  /** Async validation با debounce. */
  // FIX (BUG-FRM-05): تنظیم debounce per-field.
  setFieldDebounce(field: string, ms: number): void {
    this._fieldDebounce.set(field, ms);
  }

  private _debouncedAsyncValidate(name: string): void {
    // Clear existing timer.
    const existing = this._asyncValidationTimers.get(name);
    if (existing) clearTimeout(existing);

    // FIX (BUG-FRM-05): استفاده از debounce per-field اگر تنظیم شده باشد.
    const debounceMs = this._fieldDebounce.get(name) ?? FormStore.DEFAULT_DEBOUNCE_MS;
    this._asyncValidationTimers.set(name, setTimeout(async () => {
      this._asyncValidationTimers.delete(name);
      await this._validateFieldAsync(name);
    }, debounceMs));
  }

  /** اجرای async validation روی یک فیلد. */
  async _validateFieldAsync(name: string): Promise<void> {
    const gen = ++this._validationGeneration;
    // FIX (BUG-FRM-02): هر بار که validation جدید شروع می‌شود، generation increment
    // می‌شود. فقط نتیجه‌ای که با gen فعلی مطابقت دارد اعمال می‌شود.
    const state = this._signal.get();
    const field = state.fields[name];
    if (!field) return;

    // Set validating state.
    this._signal.set({
      ...state,
      fields: {
        ...state.fields,
        [name]: { ...field, validating: true },
      },
      validating: true,
    });

    const allValues: Record<string, any> = {};
    for (const [k, v] of Object.entries(this._signal.get().fields) as [string, FormFieldState][]) allValues[k] = v.value;

    // FIX (v1.2.3): پاس دادن AbortSignal به validateFieldAsync تا هنگام destroy
    // بتوان درخواست‌های در حال انجام را لغو کرد.
    const result = await validateFieldAsync(field.value, this._rules[name] || '', allValues, this._abortController.signal);

    const currentState = this._signal.get();
    const currentField = currentState.fields[name];
    if (!currentField) return;
    // FIX (BUG-FRM-02): اگر generation تغییر کرده، این result قدیمی است.
    if (gen !== this._validationGeneration) return;
    // BUG-11 FIX (v1.2.2): قبلاً valid از this._signal.get().fields محاسبه می‌شد
    // که state قدیمی است (قبل از اعمال نتیجه‌ی async validation). این کار باعث
    // می‌شد فلگ valid پس از پایان async validation همچنان stale بماند. حالا
    // ابتدا newFields را می‌سازیم و سپس valid را از همان newFields محاسبه
    // می‌کنیم.
    const newFields = {
      ...currentState.fields,
      [name]: {
        ...currentField,
        validation: result,
        validating: false,
      },
    };
    this._signal.set({
      ...currentState,
      fields: newFields,
      validating: false,
      valid: Object.values(newFields).every((f: FormFieldState) => f.validation.valid),
    });
  }

  touch(name: string): void {
    const state = this._signal.get();
    const field = state.fields[name];
    if (!field || field.touched) return;
    this._signal.set({
      ...state,
      fields: { ...state.fields, [name]: { ...field, touched: true } },
    });
  }

  touchAll(): void {
    const state = this._signal.get();
    const newFields: Record<string, FormFieldState> = {};
    for (const [k, v] of Object.entries(state.fields)) {
      newFields[k] = { ...v, touched: true };
    }
    this._signal.set({ ...state, fields: newFields });
  }

  validate(): FormValidation {
    const state = this._signal.get();
    const values: Record<string, any> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][]) values[k] = v.value;
    const result = validateForm(values, this._rules);
    const newFields = { ...state.fields };
    for (const [name, validation] of Object.entries(result.fields)) {
      const existing = newFields[name];
      if (existing) {
        newFields[name] = { ...existing, validation };
      }
    }
    this._signal.set({ ...state, fields: newFields, valid: result.valid });
    return result;
  }

  /** اعتبارسنجی async کل فرم. */
  async validateAsync(): Promise<FormValidation> {
    const state = this._signal.get();
    this._signal.set({ ...state, validating: true });

    const values: Record<string, any> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][]) values[k] = v.value;
    const result = await validateFormAsync(values, this._rules);

    // FIX (v1.2.3): قبلاً newFields از state.fields قدیمی (snapshot قبل از await)
    // ساخته می‌شد و سپس در this._signal.get().fields (current) قرار می‌گرفت —
    // یعنی تغییرات صورت‌گرفته در طول await (مثلاً setValue توسط کاربر) کور
    // می‌شدند. حالا newFields از current fields ساخته می‌شود تا تغییرات
    // صورت‌گرفته در طول await حفظ شوند و فقط validation results مرج شوند.
    const currentFields = this._signal.get().fields;
    const newFields: Record<string, FormFieldState> = { ...currentFields };
    for (const [name, validation] of Object.entries(result.fields)) {
      const existing = newFields[name];
      if (existing) {
        newFields[name] = { ...existing, validation, validating: false };
      }
    }

    this._signal.set({
      ...this._signal.get(),
      fields: newFields,
      valid: result.valid,
      validating: false,
    });

    return result;
  }

  isValid(): boolean { return this._signal.get().valid; }

  startSubmit(): void { this._signal.set({ ...this._signal.get(), submitting: true }); }
  endSubmit(): void { this._signal.set({ ...this._signal.get(), submitting: false, submitted: true }); }

  /** Submit handler با auto-validation. */
  async submit(handler: (values: Record<string, any>) => Promise<void> | void): Promise<boolean> {
    this.touchAll();
    const syncResult = this.validate();
    if (!syncResult.valid) return false;

    // Async validation.
    const asyncResult = await this.validateAsync();
    if (!asyncResult.valid) return false;

    this.startSubmit();
    try {
      await handler(this.getValues());
      this.endSubmit();
      return true;
    } catch (err) {
      this._signal.set({
        ...this._signal.get(),
        submitting: false,
        formError: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  getValues(): Record<string, any> {
    const state = this._signal.get();
    const values: Record<string, any> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][]) values[k] = v.value;
    return values;
  }

  setFormError(error: string | null): void {
    this._signal.set({ ...this._signal.get(), formError: error });
  }

  // ── Form Arrays ──
  /** افزودن فیلد داینامیک. */
  addField(name: string, initial: any, rules?: string): void {
    const state = this._signal.get();
    if (state.fields[name]) return; // Already exists
    this._rules[name] = rules || '';
    this._initialValues[name] = initial;
    this._signal.set({
      ...state,
      fields: {
        ...state.fields,
        [name]: {
          value: initial,
          touched: false,
          dirty: false,
          validation: validateField(initial, rules || ''),
          validating: false,
        },
      },
      valid: Object.values(state.fields).every((f: FormFieldState) => f.validation.valid) && validateField(initial, rules || '').valid,
    });
  }

  /** حذف فیلد داینامیک. */
  removeField(name: string): void {
    const state = this._signal.get();
    if (!state.fields[name]) return;
    const newFields = { ...state.fields };
    delete newFields[name];
    delete this._rules[name];
    delete this._initialValues[name];
    this._signal.set({
      ...state,
      fields: newFields,
      valid: Object.values(newFields).every((f: FormFieldState) => f.validation.valid),
      dirty: Object.values(newFields).some((f: FormFieldState) => f.dirty),
    });
  }

  /** Push یک آیتم به فیلد از نوع array. */
  pushItem(fieldName: string, item: any): void {
    const arr = this.getValue(fieldName);
    if (!Array.isArray(arr)) return;
    this.setValue(fieldName, [...arr, item]);
  }

  /** Remove یک آیتم از فیلد array. */
  removeItem(fieldName: string, index: number): void {
    const arr = this.getValue(fieldName);
    if (!Array.isArray(arr)) {
      console.error(`[Zenith] removeItem: "${fieldName}" is not an array`);
      return;
    }
    // FIX (BUG-FRM-03): اعتبارسنجی index.
    if (index < 0 || index >= arr.length) {
      console.error(`[Zenith] removeItem: index ${index} out of bounds for "${fieldName}" (length=${arr.length})`);
      return;
    }
    this.setValue(fieldName, arr.filter((_, i) => i !== index));
  }

  /** Move یک آیتم در array. */
  moveItem(fieldName: string, from: number, to: number): void {
    const arr = [...this.getValue(fieldName)];
    if (!Array.isArray(arr)) {
      console.error(`[Zenith] moveItem: "${fieldName}" is not an array`);
      return;
    }
    // FIX (BUG-FRM-03): اعتبارسنجی indexها با خطای مشخص.
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) {
      console.error(`[Zenith] moveItem: index out of bounds for "${fieldName}" (length=${arr.length}, from=${from}, to=${to})`);
      return;
    }
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    this.setValue(fieldName, arr);
  }

  reset(): void {
    for (const timer of this._asyncValidationTimers.values()) clearTimeout(timer);
    this._asyncValidationTimers.clear();

    const fieldStates: Record<string, FormFieldState> = {};
    for (const [name, initial] of Object.entries(this._initialValues)) {
      fieldStates[name] = {
        value: initial,
        touched: false,
        dirty: false,
        validation: validateField(initial, this._rules[name] || ''),
        validating: false,
      };
    }
    this._signal.set({
      fields: fieldStates,
      submitting: false,
      submitted: false,
      valid: Object.values(fieldStates).every((f: FormFieldState) => f.validation.valid),
      dirty: false,
      formError: null,
      validating: false,
    });
  }

  /**
   * BUG FIX (BUG-03): پاکسازی کامل FormStore.
   *
   * تمام تایمرهای async validation در حال pending را پاک می‌کند. این
   * تابع باید هنگام teardown اپ (مثلاً در Zen.stop یا unmount یک فرم)
   * فراخوانی شود تا zombie timer callbacks که بعد از destroy اجرا
   * می‌شوند و state را mutate می‌کنند، جلوگیری شود.
   *
   * نکته: این تابع idempotent است — فراخوانی دوباره آن بی‌اثر است.
   */
  destroy(): void {
    // FIX (v1.2.3): abort درخواست‌های in-flight async validation قبل از پاک‌سازی
    // تایمرها. این کار از zombie callbacks جلوگیری می‌کند که پس از destroy
    // اجرا شده و state را mutate می‌کردند.
    this._abortController.abort();
    for (const timer of this._asyncValidationTimers.values()) clearTimeout(timer);
    this._asyncValidationTimers.clear();
  }
}

export function createForm(fields: Record<string, { initial: any; rules?: string }>): FormStore {
  return new FormStore(fields);
}

// ============================================================
// FEATURE (v1.4.0): Advanced Reactive Form API
// ============================================================

import { computed, type ReadonlySignal, onCleanup } from '@zenith/state';

export type ValidationResult = boolean | string | Promise<boolean | string>;
export type Validator<T = any> = (value: T, formValues: any) => ValidationResult;

export interface FieldState<T = any> {
  value: Signal<T>;
  error: Signal<string | null>;
  touched: Signal<boolean>;
  dirty: Signal<boolean>;
  validating: Signal<boolean>;
}

export interface FormState<T> {
  values: Signal<T>;
  errors: Signal<Record<string, string | null>>;
  formError: Signal<string | null>;
  submitting: Signal<boolean>;
  validating: Signal<boolean>;
  touched: ReadonlySignal<boolean>;
  dirty: ReadonlySignal<boolean>;
  valid: ReadonlySignal<boolean>;
}

export interface AdvancedFormOptions<T extends Record<string, any>> {
  initialValues: T;
  validate?: Partial<Record<keyof T, Validator | Validator[]>>;
  validateForm?: (values: T) => ValidationResult;
  schema?: {
    parse: (values: any) => any;
    safeParse: (values: any) => { success: boolean; error?: any; data?: any };
  };
  onSubmit?: (values: T) => void | Promise<void>;
  autoSave?: {
    enabled: boolean;
    interval?: number;
    handler: (values: T) => void | Promise<void>;
  };
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface AdvancedFormApi<T extends Record<string, any>> extends FormState<T> {
  field: <K extends keyof T>(name: K) => FieldState<T[K]>;
  nested: <K = any>(path: string) => FieldState<K>;
  array: <K = any>(path: string) => FieldArrayApi<K>;
  setFieldValue: (name: string, value: any) => void;
  setFieldError: (name: string, error: string | null) => void;
  setFieldTouched: (name: string, touched?: boolean) => void;
  validate: () => Promise<boolean>;
  validateField: (name: string) => Promise<string | null>;
  reset: (values?: T) => void;
  submit: () => Promise<void>;
  startSubmit: () => void;
  endSubmit: () => void;
}

export interface FieldArrayApi<T> {
  items: Signal<T[]>;
  push: (item: T) => void;
  insert: (index: number, item: T) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  swap: (indexA: number, indexB: number) => void;
  clear: () => void;
  length: ReadonlySignal<number>;
}

/**
 * Create a fully-featured reactive form with nested fields, arrays,
 * schema validation, async validators, auto-save, and dirty/touched tracking.
 */
export function createAdvancedForm<T extends Record<string, any>>(
  options: AdvancedFormOptions<T>
): AdvancedFormApi<T> {
  const {
    initialValues,
    validate,
    validateForm: formValidator,
    schema,
    onSubmit,
    autoSave,
    validateOnChange = true,
    validateOnBlur = false
  } = options;

  const values = signal<T>({ ...initialValues });
  const errors = signal<Record<string, string | null>>({});
  const formError = signal<string | null>(null);
  const submitting = signal(false);
  const validating = signal(false);
  const touchedFields = signal<Record<string, boolean>>({});
  const dirtyFields = signal<Record<string, boolean>>({});

  const touched = computed(() => Object.values(touchedFields.get()).some(Boolean));
  const dirty = computed(() => Object.values(dirtyFields.get()).some(Boolean));
  const valid = computed(() => {
    const err = errors.get();
    return Object.values(err).every(e => e === null || e === undefined);
  });

  // Auto-save setup
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  if (autoSave?.enabled) {
    effect(() => {
      const current = values.get();
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(async () => {
        try {
          await autoSave.handler(current);
        } catch {
          formError.set('Auto-save failed');
        }
      }, autoSave.interval || 2000);
    });

    onCleanup(() => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
    });
  }

  async function validateField(name: string): Promise<string | null> {
    const currentValues = values.get();
    const fieldValue = (currentValues as any)[name];

    if (schema) {
      const result = schema.safeParse(currentValues);
      if (!result.success && result.error) {
        const fieldError = result.error.errors?.find(
          (e: any) => e.path?.[0] === name
        );
        if (fieldError) {
          const msg = fieldError.message || 'Invalid value';
          setFieldError(name, msg);
          return msg;
        }
      }
    }

    const fieldValidators = validate?.[name as keyof T];
    if (fieldValidators) {
      const validators = Array.isArray(fieldValidators) ? fieldValidators : [fieldValidators];
      for (const validator of validators) {
        const result = await validator(fieldValue, currentValues);
        if (result === false) {
          const msg = 'Invalid value';
          setFieldError(name, msg);
          return msg;
        }
        if (typeof result === 'string') {
          setFieldError(name, result);
          return result;
        }
      }
    }

    setFieldError(name, null);
    return null;
  }

  async function validateAll(): Promise<boolean> {
    validating.set(true);
    const fieldNames = Object.keys({ ...initialValues, ...values.get() });
    const results = await Promise.all(fieldNames.map(validateField));

    if (formValidator) {
      const formResult = await formValidator(values.get());
      if (formResult === false || typeof formResult === 'string') {
        formError.set(typeof formResult === 'string' ? formResult : 'Form is invalid');
        validating.set(false);
        return false;
      }
    }

    validating.set(false);
    formError.set(null);
    return results.every(r => r === null);
  }

  function setFieldValue(name: string, value: any) {
    const current = values.get();
    const updated = { ...current, [name]: value };
    values.set(updated);

    const initial = (initialValues as any)[name];
    const isDirty = JSON.stringify(value) !== JSON.stringify(initial);
    dirtyFields.set({ ...dirtyFields.get(), [name]: isDirty });

    if (validateOnChange && !validateOnBlur) {
      validateField(name);
    }
  }

  function setFieldError(name: string, error: string | null) {
    errors.set({ ...errors.get(), [name]: error });
  }

  function setFieldTouched(name: string, isTouched = true) {
    touchedFields.set({ ...touchedFields.get(), [name]: isTouched });
    if (validateOnBlur && isTouched) {
      validateField(name);
    }
  }

  function getField<K extends keyof T>(name: K): FieldState<T[K]> {
    const nameStr = String(name);
    return {
      value: computed(() => values.get()[name]) as unknown as Signal<T[K]>,
      error: computed(() => errors.get()[nameStr] || null) as unknown as Signal<string | null>,
      touched: computed(() => !!touchedFields.get()[nameStr]) as unknown as Signal<boolean>,
      dirty: computed(() => !!dirtyFields.get()[nameStr]) as unknown as Signal<boolean>,
      validating
    };
  }

  function getNested<K = any>(path: string): FieldState<K> {
    const getNestedValue = (obj: any, p: string): any => {
      return p.split('.').reduce((acc, key) => acc?.[key], obj);
    };

    return {
      value: computed(() => getNestedValue(values.get(), path)) as unknown as Signal<K>,
      error: computed(() => errors.get()[path] || null) as unknown as Signal<string | null>,
      touched: computed(() => !!touchedFields.get()[path]) as unknown as Signal<boolean>,
      dirty: computed(() => !!dirtyFields.get()[path]) as unknown as Signal<boolean>,
      validating
    };
  }

  function getFieldArray<K = any>(path: string): FieldArrayApi<K> {
    const getArray = (): K[] => {
      const v = values.get() as any;
      return v[path] || [];
    };

    const setArray = (newArr: K[]) => {
      values.set({ ...values.get(), [path]: newArr });
      dirtyFields.set({ ...dirtyFields.get(), [path]: true });
    };

    const items = computed(getArray) as unknown as Signal<K[]>;
    const length = computed(() => getArray().length);

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
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        setArray(arr);
      },
      swap: (a, b) => {
        const arr = [...getArray()];
        [arr[a], arr[b]] = [arr[b], arr[a]];
        setArray(arr);
      },
      clear: () => setArray([])
    };
  }

  async function submit() {
    const isValid = await validateAll();
    if (!isValid) return;

    submitting.set(true);
    formError.set(null);

    try {
      await onSubmit?.(values.get());
    } catch (e) {
      formError.set(e instanceof Error ? e.message : 'Submission failed');
      throw e;
    } finally {
      submitting.set(false);
    }
  }

  function reset(newValues?: T) {
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
    field: getField,
    nested: getNested,
    array: getFieldArray,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    validate: validateAll,
    validateField,
    reset,
    submit,
    startSubmit: () => submitting.set(true),
    endSubmit: () => submitting.set(false)
  };
}

// ============================================================
// Multi-Step Wizard Form Support
// ============================================================

export interface WizardStep {
  id: string;
  title: string;
  fields: string[];
  validate?: () => Promise<boolean>;
}

export interface WizardFormApi<T extends Record<string, any>> extends AdvancedFormApi<T> {
  currentStep: Signal<number>;
  steps: Signal<WizardStep[]>;
  canGoNext: Signal<boolean>;
  canGoBack: ReadonlySignal<boolean>;
  next: () => Promise<void>;
  previous: () => void;
  goToStep: (index: number) => void;
  isStepComplete: (index: number) => boolean;
}

/**
 * Create a multi-step wizard form.
 */
export function createWizardForm<T extends Record<string, any>>(
  options: AdvancedFormOptions<T> & { steps: WizardStep[] }
): WizardFormApi<T> {
  const form = createAdvancedForm(options);
  const currentStep = signal(0);
  const steps = signal(options.steps);
  const completedSteps = signal<Set<number>>(new Set());

  const canGoBack = computed(() => currentStep.get() > 0);

  // canGoNext is a regular signal updated by an effect (not async computed)
  const canGoNext = signal(false);
  effect(() => {
    const stepIndex = currentStep.get();
    const step = steps.get()[stepIndex];
    if (!step) {
      canGoNext.set(false);
      return;
    }
    // Validate current step fields synchronously (async validation would need Promise)
    const errs = form.errors.get();
    const allValid = step.fields.every(f => !errs[f]);
    canGoNext.set(allValid);
  });

  async function next() {
    const stepIndex = currentStep.get();
    const step = steps.get()[stepIndex];
    if (!step) return;

    // Validate step fields
    const results = await Promise.all(step.fields.map(f => form.validateField(f)));
    if (!results.every(r => r === null)) return;

    completedSteps.get().add(stepIndex);
    completedSteps.set(new Set(completedSteps.get()));

    if (stepIndex < steps.get().length - 1) {
      currentStep.set(stepIndex + 1);
    } else {
      await form.submit();
    }
  }

  function previous() {
    if (currentStep.get() > 0) {
      currentStep.set(currentStep.get() - 1);
    }
  }

  function goToStep(index: number) {
    if (index >= 0 && index < steps.get().length) {
      currentStep.set(index);
    }
  }

  function isStepComplete(index: number): boolean {
    return completedSteps.get().has(index);
  }

  return {
    ...form,
    currentStep,
    steps,
    canGoNext,
    canGoBack,
    next,
    previous,
    goToStep,
    isStepComplete
  };
}
