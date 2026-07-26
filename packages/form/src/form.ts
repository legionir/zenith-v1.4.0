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

import { signal, type Signal } from '@zenith/state';

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
