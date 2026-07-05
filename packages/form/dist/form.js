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
import { signal } from '@zenith/state';
import { validateField, validateFieldAsync, validateForm, validateFormAsync } from './validator.js';
export class FormStore {
    _signal;
    _initialValues;
    _rules;
    _asyncValidationTimers = new Map();
    // FIX (v1.2.3): AbortController برای لغو in-flight async validation هنگام destroy.
    _abortController = new AbortController();
    constructor(fields) {
        this._initialValues = {};
        this._rules = {};
        const fieldStates = {};
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
        this._signal = signal({
            fields: fieldStates,
            submitting: false,
            submitted: false,
            valid: Object.values(fieldStates).every((f) => f.validation.valid),
            dirty: false,
            formError: null,
            validating: false,
        });
    }
    get signal() { return this._signal; }
    getValue(name) { return this._signal.get().fields[name]?.value; }
    setValue(name, value) {
        this._updateField(name, value, false);
        // Trigger async validation with debounce.
        this._debouncedAsyncValidate(name);
    }
    /** SetValue + touch + immediate sync validation. */
    setValueAndTouch(name, value) {
        this._updateField(name, value, true);
        this._debouncedAsyncValidate(name);
    }
    _updateField(name, value, touch) {
        const state = this._signal.get();
        const field = state.fields[name];
        if (!field)
            return;
        const allValues = {};
        for (const [k, v] of Object.entries(state.fields))
            allValues[k] = v.value;
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
        // FIX (v1.2.3): قبلاً فقط equalsField بررسی می‌شد. حالا differentFrom و requiresField هم چک می‌شوند.
        for (const [otherName, otherField] of Object.entries(newFields)) {
            if (otherName === name)
                continue;
            const otherRules = this._rules[otherName] || '';
            if (otherRules.includes('equalsField') ||
                otherRules.includes('differentFrom') ||
                otherRules.includes('requiresField')) {
                const newAllValues = {};
                for (const [k, v] of Object.entries(newFields))
                    newAllValues[k] = v.value;
                newFields[otherName] = {
                    ...otherField,
                    validation: validateField(otherField.value, otherRules, newAllValues),
                };
            }
        }
        this._signal.set({
            ...state,
            fields: newFields,
            valid: Object.values(newFields).every((f) => f.validation.valid),
            dirty: Object.values(newFields).some((f) => f.dirty),
        });
    }
    /** Async validation با debounce. */
    _debouncedAsyncValidate(name) {
        // Clear existing timer.
        const existing = this._asyncValidationTimers.get(name);
        if (existing)
            clearTimeout(existing);
        this._asyncValidationTimers.set(name, setTimeout(async () => {
            this._asyncValidationTimers.delete(name);
            await this._validateFieldAsync(name);
        }, 300));
    }
    /** اجرای async validation روی یک فیلد. */
    async _validateFieldAsync(name) {
        const state = this._signal.get();
        const field = state.fields[name];
        if (!field)
            return;
        // Set validating state.
        this._signal.set({
            ...state,
            fields: {
                ...state.fields,
                [name]: { ...field, validating: true },
            },
            validating: true,
        });
        const allValues = {};
        for (const [k, v] of Object.entries(this._signal.get().fields))
            allValues[k] = v.value;
        // FIX (v1.2.3): پاس دادن AbortSignal به validateFieldAsync.
        const result = await validateFieldAsync(field.value, this._rules[name] || '', allValues, this._abortController.signal);
        const currentState = this._signal.get();
        const currentField = currentState.fields[name];
        if (!currentField)
            return;
        // BUG-11 FIX (v1.2.2): valid را از newFields محاسبه کن، نه از this._signal.get().fields
        // (که state قدیمی است).
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
            valid: Object.values(newFields).every((f) => f.validation.valid),
        });
    }
    touch(name) {
        const state = this._signal.get();
        const field = state.fields[name];
        if (!field || field.touched)
            return;
        this._signal.set({
            ...state,
            fields: { ...state.fields, [name]: { ...field, touched: true } },
        });
    }
    touchAll() {
        const state = this._signal.get();
        const newFields = {};
        for (const [k, v] of Object.entries(state.fields)) {
            newFields[k] = { ...v, touched: true };
        }
        this._signal.set({ ...state, fields: newFields });
    }
    validate() {
        const state = this._signal.get();
        const values = {};
        for (const [k, v] of Object.entries(state.fields))
            values[k] = v.value;
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
    async validateAsync() {
        const state = this._signal.get();
        this._signal.set({ ...state, validating: true });
        const values = {};
        for (const [k, v] of Object.entries(state.fields))
            values[k] = v.value;
        const result = await validateFormAsync(values, this._rules);
        // FIX (v1.2.3): newFields از current fields ساخته می‌شود تا تغییرات در طول await حفظ شوند.
        const currentFields = this._signal.get().fields;
        const newFields = { ...currentFields };
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
    isValid() { return this._signal.get().valid; }
    startSubmit() { this._signal.set({ ...this._signal.get(), submitting: true }); }
    endSubmit() { this._signal.set({ ...this._signal.get(), submitting: false, submitted: true }); }
    /** Submit handler با auto-validation. */
    async submit(handler) {
        this.touchAll();
        const syncResult = this.validate();
        if (!syncResult.valid)
            return false;
        // Async validation.
        const asyncResult = await this.validateAsync();
        if (!asyncResult.valid)
            return false;
        this.startSubmit();
        try {
            await handler(this.getValues());
            this.endSubmit();
            return true;
        }
        catch (err) {
            this._signal.set({
                ...this._signal.get(),
                submitting: false,
                formError: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }
    getValues() {
        const state = this._signal.get();
        const values = {};
        for (const [k, v] of Object.entries(state.fields))
            values[k] = v.value;
        return values;
    }
    setFormError(error) {
        this._signal.set({ ...this._signal.get(), formError: error });
    }
    // ── Form Arrays ──
    /** افزودن فیلد داینامیک. */
    addField(name, initial, rules) {
        const state = this._signal.get();
        if (state.fields[name])
            return; // Already exists
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
            valid: Object.values(state.fields).every((f) => f.validation.valid) && validateField(initial, rules || '').valid,
        });
    }
    /** حذف فیلد داینامیک. */
    removeField(name) {
        const state = this._signal.get();
        if (!state.fields[name])
            return;
        const newFields = { ...state.fields };
        delete newFields[name];
        delete this._rules[name];
        delete this._initialValues[name];
        this._signal.set({
            ...state,
            fields: newFields,
            valid: Object.values(newFields).every((f) => f.validation.valid),
            dirty: Object.values(newFields).some((f) => f.dirty),
        });
    }
    /** Push یک آیتم به فیلد از نوع array. */
    pushItem(fieldName, item) {
        const arr = this.getValue(fieldName);
        if (!Array.isArray(arr))
            return;
        this.setValue(fieldName, [...arr, item]);
    }
    /** Remove یک آیتم از فیلد array. */
    removeItem(fieldName, index) {
        const arr = this.getValue(fieldName);
        if (!Array.isArray(arr))
            return;
        this.setValue(fieldName, arr.filter((_, i) => i !== index));
    }
    /** Move یک آیتم در array. */
    moveItem(fieldName, from, to) {
        const arr = [...this.getValue(fieldName)];
        if (!Array.isArray(arr))
            return;
        if (from < 0 || from >= arr.length || to < 0 || to >= arr.length)
            return;
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this.setValue(fieldName, arr);
    }
    reset() {
        for (const timer of this._asyncValidationTimers.values())
            clearTimeout(timer);
        this._asyncValidationTimers.clear();
        const fieldStates = {};
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
            valid: Object.values(fieldStates).every((f) => f.validation.valid),
            dirty: false,
            formError: null,
            validating: false,
        });
    }
    /**
     * BUG FIX (BUG-03): پاکسازی کامل FormStore.
     *
     * تمام تایمرهای async validation در حال pending را پاک می‌کند.
     * Idempotent — فراخوانی دوباره آن بی‌اثر است.
     */
    destroy() {
        // FIX (v1.2.3): abort درخواست‌های in-flight async validation.
        this._abortController.abort();
        for (const timer of this._asyncValidationTimers.values())
            clearTimeout(timer);
        this._asyncValidationTimers.clear();
    }
}
export function createForm(fields) {
    return new FormStore(fields);
}
//# sourceMappingURL=form.js.map