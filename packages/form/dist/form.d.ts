import { type Signal } from '@zenith/state';
import { type FieldValidation, type FormValidation } from './validator';
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
export declare class FormStore {
    private _signal;
    private _initialValues;
    private _rules;
    private _asyncValidationTimers;
    constructor(fields: Record<string, {
        initial: any;
        rules?: string;
    }>);
    get signal(): Signal<FormStoreState>;
    getValue(name: string): any;
    setValue(name: string, value: any): void;
    /** SetValue + touch + immediate sync validation. */
    setValueAndTouch(name: string, value: any): void;
    private _updateField;
    /** Async validation با debounce. */
    private _debouncedAsyncValidate;
    /** اجرای async validation روی یک فیلد. */
    _validateFieldAsync(name: string): Promise<void>;
    touch(name: string): void;
    touchAll(): void;
    validate(): FormValidation;
    /** اعتبارسنجی async کل فرم. */
    validateAsync(): Promise<FormValidation>;
    isValid(): boolean;
    startSubmit(): void;
    endSubmit(): void;
    /** Submit handler با auto-validation. */
    submit(handler: (values: Record<string, any>) => Promise<void> | void): Promise<boolean>;
    getValues(): Record<string, any>;
    setFormError(error: string | null): void;
    /** افزودن فیلد داینامیک. */
    addField(name: string, initial: any, rules?: string): void;
    /** حذف فیلد داینامیک. */
    removeField(name: string): void;
    /** Push یک آیتم به فیلد از نوع array. */
    pushItem(fieldName: string, item: any): void;
    /** Remove یک آیتم از فیلد array. */
    removeItem(fieldName: string, index: number): void;
    /** Move یک آیتم در array. */
    moveItem(fieldName: string, from: number, to: number): void;
    reset(): void;
}
export declare function createForm(fields: Record<string, {
    initial: any;
    rules?: string;
}>): FormStore;
