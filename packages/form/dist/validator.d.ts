export interface FieldValidation {
    valid: boolean;
    error: string | null;
    rule?: string;
}
export interface FormValidation {
    valid: boolean;
    fields: Record<string, FieldValidation>;
}
type ValidationRule = (value: any, allValues: Record<string, any>, param?: string) => FieldValidation;
type AsyncValidationRule = (value: any, allValues: Record<string, any>, param?: string, signal?: AbortSignal) => Promise<FieldValidation>;
export declare function defineRule(name: string, fn: ValidationRule): void;
/** ثبت یک قانون async (مثل بررسی uniqueness از سرور). */
export declare function defineAsyncRule(name: string, fn: AsyncValidationRule): void;
/**
 * دریافت مقدار یک فیلد با پشتیبانی از dot notation.
 * مثلاً "address.city" → values.address.city
 */
export declare function getNestedValue(values: Record<string, any>, path: string): any;
/**
 * تنظیم مقدار یک فیلد با پشتیبانی از dot notation.
 */
export declare function setNestedValue(values: Record<string, any>, path: string, value: any): Record<string, any>;
/**
 * ساخت یک flat object از nested values برای validation.
 * مثلاً { address: { city: 'Tehran' } } → { 'address.city': 'Tehran' }
 */
export declare function flattenValues(values: Record<string, any>, prefix?: string): Record<string, any>;
export declare function validateField(value: any, rulesStr: string, allValues?: Record<string, any>): FieldValidation;
/**
 * اعتبارسنجی async یک فیلد (برای rules مثل uniqueness).
 *
 * FEATURE (v1.0.0): پشتیبانی از AbortSignal برای لغو درخواست‌های قبلی.
 */
export declare function validateFieldAsync(value: any, rulesStr: string, allValues?: Record<string, any>, signal?: AbortSignal): Promise<FieldValidation>;
/**
 * اعتبارسنجی کل فرم با پشتیبانی از nested fields (dot notation).
 *
 * FEATURE (v1.0.0): rules با کلیدهای dot notation پشتیبانی می‌شوند.
 * مثلاً { 'address.city': 'required', 'address.zip': 'required,min:5' }
 */
export declare function validateForm(values: Record<string, any>, rules: Record<string, string>): FormValidation;
/**
 * اعتبارسنجی async کل فرم.
 */
export declare function validateFormAsync(values: Record<string, any>, rules: Record<string, string>, signal?: AbortSignal): Promise<FormValidation>;
export declare function clearCustomRules(): void;
export interface FormValidationLifecycle {
    /** قبل از validation صدا زده می‌شود. اگر false برگرداند، validation skip می‌شود. */
    onBeforeValidate?: (values: Record<string, any>) => boolean | Promise<boolean>;
    /** بعد از validation صدا زده می‌شود. */
    onAfterValidate?: (result: FormValidation, values: Record<string, any>) => void;
    /** وقتی یک فیلد تغییر می‌کند. */
    onFieldChange?: (name: string, value: any, allValues: Record<string, any>) => void;
    /** وقتی یک فیلد invalid می‌شود. */
    onFieldError?: (name: string, error: string, allValues: Record<string, any>) => void;
    /** وقتی کل فرم valid می‌شود. */
    onFormValid?: (values: Record<string, any>) => void;
    /** وقتی کل فرم invalid می‌شود. */
    onFormInvalid?: (result: FormValidation, values: Record<string, any>) => void;
}
/**
 * اجرای validation با lifecycle hooks.
 */
export declare function validateWithLifecycle(values: Record<string, any>, rules: Record<string, string>, lifecycle: FormValidationLifecycle, async?: boolean): Promise<FormValidation>;
export interface SchemaField {
    initial?: any;
    rules?: string;
    label?: string;
    type?: 'text' | 'number' | 'email' | 'password' | 'checkbox' | 'select' | 'textarea';
    options?: Array<{
        value: string;
        label: string;
    }>;
    placeholder?: string;
}
export interface FormSchema {
    fields: Record<string, SchemaField>;
    submitLabel?: string;
    /** FEATURE (v1.0.0): Nested schema برای sub-forms. */
    nested?: Record<string, FormSchema>;
}
export declare function schemaToFormConfig(schema: FormSchema): Record<string, {
    initial: any;
    rules?: string;
}>;
export declare function schemaToHtml(schema: FormSchema, formVar?: string): string;
export {};
