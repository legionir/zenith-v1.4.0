import type { Signal, ReadonlySignal } from '@zenith/state';
import type { FieldValidation } from './validator';
/** @public */
export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean | string | Promise<boolean | string>;
  message?: string;
}

/**
 * Unified reactive form options (#50 / #128: یکسان‌سازی `FormOptions` و `AdvancedFormOptions`).
 */
/** @public */
export interface FormOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  initialValues?: T;
  /** #128: قواعد رشته‌ای اعتبارسنجی به ازای هر فیلد (مثلاً `'required|email'`) */
  rules?: Partial<Record<keyof T, string>>;
  validation?: { [K in keyof T]?: ValidationRule<T[K]> | ValidationRule<T[K]>[] };
  validate?: { [K in keyof T]?: Validator<T[K], T> | Validator<T[K], T>[] };
  validateForm?: (values: T) => ValidationResult;
  schema?: {
    parse: (values: unknown) => unknown;
    safeParse: (values: unknown) => {
      success?: boolean;
      ok?: boolean;
      error?: unknown;
      issues?: Array<{ path?: string; message?: string }>;
      data?: unknown;
      value?: unknown;
    };
  };
  /** #128: گام‌های چندمرحله‌ای (Wizard) در همان ورودی یکپارچهٔ `createForm` */
  steps?: WizardStep[];
  onSubmit?: (values: T) => void | Promise<void>;
  autoSave?: {
    enabled: boolean;
    interval?: number;
    handler: (values: T) => void | Promise<void>;
  };
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/** @public */
export interface FormFieldState {
  value: unknown;
  touched: boolean;
  dirty: boolean;
  validation: FieldValidation;
  /** آیا در حال async validation است؟ */
  validating: boolean;
}

/** @public */
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

/** @public */
export type ValidationResult = boolean | string | Promise<boolean | string>;
/** @public */
export type Validator<T = unknown, Values = Record<string, unknown>> = (value: T, formValues: Values) => ValidationResult;

/** @public */
export interface FieldState<T = unknown> {
  value: ReadonlySignal<T>;
  error: ReadonlySignal<string | null>;
  touched: ReadonlySignal<boolean>;
  dirty: ReadonlySignal<boolean>;
  validating: Signal<boolean>;
}

/** @public */
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

/**
 * @deprecated از `FormOptions<T>` یکپارچه استفاده کنید (#50).
 */
/** @public */
export interface AdvancedFormOptions<T extends Record<string, unknown>> extends FormOptions<T> {
  initialValues: T;
}

/** @public */
export interface AdvancedFormApi<T extends Record<string, unknown>> extends FormState<T> {
  field: <K extends keyof T>(name: K) => FieldState<T[K]>;
  nested: <K = unknown>(path: string) => FieldState<K>;
  array: <K = unknown>(path: string) => FieldArrayApi<K>;
  /** Known string fields retain their own value type; this is not payload decoding. */
  setFieldValue: <K extends Extract<keyof T, string>>(name: K, value: T[K]) => void;
  setFieldError: (name: string, error: string | null) => void;
  setFieldTouched: (name: string, touched?: boolean) => void;
  validate: () => Promise<boolean>;
  validateField: (name: string) => Promise<string | null>;
  reset: (values?: T) => void;
  submit: () => Promise<void>;
  startSubmit: () => void;
  endSubmit: () => void;
  /** Idempotently stop owned views, validators' state writes and pending autosave timers. */
  dispose: () => void;
}

/** @public */
export interface FieldArrayApi<T> {
  items: ReadonlySignal<T[]>;
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
/** @public */
export interface WizardStep {
  id: string;
  title: string;
  fields: string[];
  validate?: () => Promise<boolean>;
}

/** @public */
export interface WizardFormApi<T extends Record<string, unknown>> extends AdvancedFormApi<T> {
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

/** Native dynamic field definition used by the Store factory/constructor. @public */
export interface FormFieldDefinition { initial: unknown; rules?: string; }
/** Dynamic names do not prove which legacy factory dispatch path will be used. @public */
export type FormFieldDefinitions = Record<string, FormFieldDefinition>;
/** Small reactive form; other FormOptions features belong to the advanced API. @public */
export interface ReactiveFormApi<T extends Record<string, unknown>> {
  values: Signal<T>;
  errors: Signal<Record<string, string>>;
  submitting: Signal<boolean>;
  startSubmit(): Promise<void>;
  endSubmit(): Promise<void>;
  dispose(): void;
}
