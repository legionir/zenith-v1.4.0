import { addFormFieldOptions, moveFormItemOptions } from './validation-options';
import type { AddFormFieldOptions, MoveFormItemOptions } from './validation-types';
import { createAddedFieldState, withFieldSummary } from './form-dynamic';
import { signal, onCleanup, type Signal } from '@zenith/state';
import { createResetState, readFormValues, touchFormState, touchFieldState } from './form-reset';
import { deprecate } from '@zenith/errors';
import type { Disposable } from '@zenith/shared';
import { validateField, validateForm, type FormValidation } from './validator';
import type { FormStoreState, FormFieldState, FormFieldDefinitions } from './form-types';
import { pushItem, removeItem, moveItem } from './form-arrays';
import { StoreValidation } from './form-store-validation';
import { idleFormValidation, readFormValidation } from './form-reset';
/** @public */
export class FormStore implements Disposable {
  private _signal: Signal<FormStoreState>;
  private _initialValues: Record<string, unknown>;
  private _rules: Record<string, string>;
  private _asyncValidationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private _validation: StoreValidation;
  private _valueVersion = 0;
  private _submitRun = 0;
  private _offOwnerCleanup: (() => void) | undefined;
  // FIX (BUG-FRM-05): per-field debounce (پیش‌فرض ۳۰۰ms).
  private _fieldDebounce = new Map<string, number>();
  private static readonly DEFAULT_DEBOUNCE_MS = 300;
  // #116: فلگ dispose برای idempotency (alias destroy همان را می‌خواند).
  private _disposed = false;

  constructor(fields: FormFieldDefinitions) {
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
        validation: validateField(config.initial, { rules: config.rules || '' }),
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
    this._validation = new StoreValidation(this._signal, this._rules);
    this._offOwnerCleanup = onCleanup(() => this.dispose());
  }

  get signal(): Signal<FormStoreState> {
    return this._signal;
  }

  getValue(name: string): unknown {
    return this._signal.get().fields[name]?.value;
  }

  setValue(name: string, value: unknown): void {
    if (this._disposed) return;
    this._updateField(name, value, false);
    // Trigger async validation with debounce.
    this._debouncedAsyncValidate(name);
  }

  /** SetValue + touch + immediate sync validation. */
  setValueAndTouch(name: string, value: unknown): void {
    if (this._disposed) return;
    this._updateField(name, value, true);
    this._debouncedAsyncValidate(name);
  }

  private _updateField(name: string, value: unknown, touch: boolean): void {
    const state = this._signal.peek();
    const field = state.fields[name];
    if (!field) return;

    const allValues: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][])
      allValues[k] = v.value;

    const validation = validateField(value, { rules: this._rules[name] || '', allValues });

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
      if (
        otherRules.includes('equalsField') ||
        otherRules.includes('differentFrom') ||
        otherRules.includes('requiresField')
      ) {
        const newAllValues: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(newFields) as [string, FormFieldState][])
          newAllValues[k] = v.value;
        newFields[otherName] = {
          ...otherField,
          validation: validateField(otherField.value, { rules: otherRules, allValues: newAllValues }),
        };
      }
    }

    this._valueVersion++; this._validation.invalidate();
    this._signal.set(idleFormValidation(withFieldSummary(state, newFields)));
  }

  /** Async validation با debounce. */
  // FIX (BUG-FRM-05): تنظیم debounce per-field.
  setFieldDebounce(field: string, ms: number): void {
    if (this._disposed) return;
    this._fieldDebounce.set(field, ms);
  }

  private _debouncedAsyncValidate(name: string): void {
    if (this._disposed || !this._signal.peek().fields[name]) return;
    // Clear existing timer.
    const existing = this._asyncValidationTimers.get(name);
    if (existing !== undefined) clearTimeout(existing);

    // FIX (BUG-FRM-05): استفاده از debounce per-field اگر تنظیم شده باشد.
    const debounceMs = this._fieldDebounce.get(name) ?? FormStore.DEFAULT_DEBOUNCE_MS;
    this._asyncValidationTimers.set(
      name,
      setTimeout(() => {
        this._asyncValidationTimers.delete(name);
        const version = this._valueVersion;
        void this._validateFieldAsync(name).catch(error => {
          if (!this._disposed && version === this._valueVersion) this.setFormError(error instanceof Error ? error.message : 'Validation failed');
        });
      }, debounceMs),
    );
  }

  /** اجرای async validation روی یک فیلد. */
  async _validateFieldAsync(name: string): Promise<void> { await this._validation.field(name); }

  touch(name: string): void {
    if (this._disposed) return;
    const state = this._signal.peek();
    const next = touchFieldState(state, name);
    if (next !== state) this._signal.set(next);
  }

  touchAll(): void {
    if (this._disposed) return;
    const state = this._signal.peek();
    this._signal.set(touchFormState(state));
  }

  validate(): FormValidation {
    const state = this._signal.peek();
    if (this._disposed) return readFormValidation(state);
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state.fields) as [string, FormFieldState][])
      values[k] = v.value;
    const result = validateForm(values, this._rules);
    const newFields = { ...state.fields };
    for (const [name, validation] of Object.entries(result.fields)) {
      const existing = newFields[name];
      if (existing) {
        newFields[name] = { ...existing, validation };
      }
    }
    if (!this._disposed) this._signal.set({ ...state, fields: newFields, valid: result.valid });
    return result;
  }

  /** اعتبارسنجی async کل فرم. */
  async validateAsync(): Promise<FormValidation> { return this._validation.all(); }

  isValid(): boolean {
    return this._signal.get().valid;
  }

  startSubmit(): void {
    if (this._disposed) return;
    this._signal.set({ ...this._signal.peek(), submitting: true });
  }
  endSubmit(): void {
    if (this._disposed) return;
    this._signal.set({ ...this._signal.peek(), submitting: false, submitted: true });
  }

  /** Submit handler با auto-validation. */
  async submit(handler: (values: Record<string, unknown>) => Promise<void> | void): Promise<boolean> {
    if (this._disposed) return false;
    const version = this._valueVersion, run = ++this._submitRun;
    const current = () => !this._disposed && version === this._valueVersion && run === this._submitRun;
    this.touchAll();
    if (!this.validate().valid) return false;
    try {
      if (!(await this.validateAsync()).valid || !current() || !this._signal.peek().valid || this._signal.peek().validating) return false;
      this.startSubmit();
      await handler(this.getValues());
      if (!current()) return false;
      this.endSubmit(); return true;
    } catch (error) {
      if (current()) this._signal.set({ ...this._signal.peek(), submitting: false, formError: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      if (!this._disposed && run === this._submitRun && this._signal.peek().submitting) this._signal.set({ ...this._signal.peek(), submitting: false });
    }
  }

  getValues(): Record<string, unknown> {
    return readFormValues(this._signal.get());
  }

  setFormError(error: string | null): void {
    if (this._disposed) return;
    this._signal.set({ ...this._signal.peek(), formError: error });
  }

  // ── Form Arrays ──
  /** @public */
  addField(options: AddFormFieldOptions): void;
  /** @public @deprecated Use addField({ name, initial, rules }) (ZEN-DEPR-100; removal in 2.0). */
  addField(name: string, initial: unknown, rules?: string): void;
  addField(optionsOrName: AddFormFieldOptions | string, legacyInitial?: unknown, legacyRules?: string): void {
    if (this._disposed) return;
    let name: string, initial: unknown, rules: string | undefined;
    if (typeof optionsOrName === 'string' || arguments.length > 1) {
      deprecate('ZEN-DEPR-100', 'addField(name, initial, rules)', 'addField({ name, initial, rules })');
      name = optionsOrName as string; initial = legacyInitial; rules = legacyRules;
    } else {
      ({ name, initial, rules } = addFormFieldOptions.resolve(optionsOrName));
    }
    const state = this._signal.peek();
    if (state.fields[name]) return;
    this._rules[name] = rules || '';
    this._initialValues[name] = initial;
    const next = createAddedFieldState(state, { name, initial, rules });
    this._valueVersion++; this._validation.invalidate();
    this._signal.set(idleFormValidation(next));
  }

  /** حذف فیلد داینامیک. */
  removeField(name: string): void {
    if (this._disposed) return;
    const state = this._signal.peek();
    if (!state.fields[name]) return;
    const newFields = { ...state.fields };
    delete newFields[name];
    delete this._rules[name];
    delete this._initialValues[name];
    this._valueVersion++; this._validation.invalidate();
    const timer = this._asyncValidationTimers.get(name);
    if (timer !== undefined) clearTimeout(timer);
    this._asyncValidationTimers.delete(name);
    this._signal.set(idleFormValidation(withFieldSummary(state, newFields)));
  }

  pushItem(fieldName: string, item: unknown): void { if (!this._disposed) pushItem.call(this, fieldName, item); }
  removeItem(fieldName: string, index: number): void { if (!this._disposed) removeItem.call(this, fieldName, index); }
  /** @public */
  moveItem(fieldName: string, options: MoveFormItemOptions): void;
  /** @public @deprecated Use moveItem(fieldName, { from, to }) (ZEN-DEPR-099; removal in 2.0). */
  moveItem(fieldName: string, from: number, to: number): void;
  moveItem(fieldName: string, optionsOrFrom: MoveFormItemOptions | number, legacyTo?: number): void {
    if (this._disposed) return;
    if (typeof optionsOrFrom !== 'object' || optionsOrFrom === null || arguments.length > 2) {
      deprecate('ZEN-DEPR-099', 'moveItem(fieldName, from, to)', 'moveItem(fieldName, { from, to })');
      moveItem.call(this, fieldName, optionsOrFrom as number, legacyTo!);
    } else {
      const { from, to } = moveFormItemOptions.resolve(optionsOrFrom);
      moveItem.call(this, fieldName, from, to);
    }
  }

  reset(): void {
    if (this._disposed) return;
    for (const timer of this._asyncValidationTimers.values()) clearTimeout(timer);
    this._asyncValidationTimers.clear();

    this._valueVersion++; this._submitRun++; this._validation.invalidate();
    this._signal.set(createResetState(this._initialValues, this._rules));
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
  dispose(): void {
    if (this._disposed) return; // #116: idempotency
    this._disposed = true;
    this._valueVersion++; this._submitRun++;
    for (const timer of this._asyncValidationTimers.values()) clearTimeout(timer);
    this._asyncValidationTimers.clear();
    const off = this._offOwnerCleanup; this._offOwnerCleanup = undefined;
    let failure: { error: unknown } | undefined;
    for (const cleanup of [
      () => this._validation.dispose(),
      () => off?.(),
      () => this._signal.set({ ...idleFormValidation(this._signal.peek()), submitting: false }),
      () => this._signal.dispose(),
    ]) {
      try { cleanup(); } catch (error) { failure ??= { error }; }
    }
    if (failure) throw failure.error;
  }

  /**
   * @deprecated #116 — نام قدیمی چرخهٔ عمر؛ از `dispose()` استفاده کن
   * (ZEN-DEPR-022؛ حذف در ۲.۰ — DEC-026).
   */
  destroy(): void {
    deprecate('ZEN-DEPR-022', 'form.destroy()', 'form.dispose()');
    this.dispose();
  }
}

