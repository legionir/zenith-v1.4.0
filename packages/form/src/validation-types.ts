/** @public */
export interface FieldValidation {
  valid: boolean;
  error: string | null;
  rule?: string;
}

/** @public */
export interface FormValidation {
  valid: boolean;
  fields: Record<string, FieldValidation>;
}

/** @public */
export type FieldValidationRule = (
  value: unknown,
  allValues: Record<string, unknown>,
  param?: string,
) => FieldValidation;
/** @public */
export type AsyncFieldValidationRule = (
  value: unknown,
  allValues: Record<string, unknown>,
  param?: string,
  signal?: AbortSignal,
) => Promise<FieldValidation>;


/** @public */
export interface FormValidationLifecycle {
  /** قبل از validation صدا زده می‌شود. اگر false برگرداند، validation skip می‌شود. */
  onBeforeValidate?: (values: Record<string, unknown>) => boolean | Promise<boolean>;
  /** بعد از validation صدا زده می‌شود. */
  onAfterValidate?: (result: FormValidation, values: Record<string, unknown>) => void;
  /** وقتی یک فیلد تغییر می‌کند. */
  onFieldChange?: (name: string, value: unknown, allValues: Record<string, unknown>) => void;
  /** وقتی یک فیلد invalid می‌شود. */
  onFieldError?: (name: string, error: string, allValues: Record<string, unknown>) => void;
  /** وقتی کل فرم valid می‌شود. */
  onFormValid?: (values: Record<string, unknown>) => void;
  /** وقتی کل فرم invalid می‌شود. */
  onFormInvalid?: (result: FormValidation, values: Record<string, unknown>) => void;
}

/** Rules plus caller-owned cross-field values; payload fields remain unknown. @public */
export interface FieldValidationOptions { rules: string; allValues?: Record<string, unknown>; }
/** @public */
export interface AsyncFieldValidationOptions extends FieldValidationOptions { signal?: AbortSignal; }
/** Single canonical bag avoids confusing field names with option names. @public */
export interface AsyncFormValidationOptions { values: Record<string, unknown>; rules: Record<string, string>; signal?: AbortSignal; }
/** @public */
export interface LifecycleValidationOptions { rules: Record<string, string>; lifecycle: FormValidationLifecycle; async?: boolean; }
/** @public */
export interface MoveFormItemOptions { from: number; to: number; }
/** The initial value is not decoded by the configuration schema. @public */
export interface AddFormFieldOptions { name: string; initial: unknown; rules?: string; }
