// packages/form/src/validator.ts
//
// Validation Engine — Phase 7 Advanced (v1.0.0 — enhanced).
//
// قابلیت‌ها:
//   - Built-in rules (required, email, url, min, max, pattern, equals, equalsField)
//   - Custom rules (defineRule)
//   - Async rules (defineAsyncRule) — server-side validation
//   - Cross-field validation (equalsField, differentFrom, requiresField)
//   - Nested form validation (dot notation: "address.city")
//   - Schema-based validation (fromSchema)
//   - Zod adapter (fromZod)
//   - Form-level validation lifecycle hooks
//   - Async validation cancellation (AbortController)

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

// ── Built-in Rules ──

const builtinRules: Record<string, ValidationRule> = {
  required: (value) => {
    // FIX (v1.2.3): قبلاً `false` برای checkbox‌های required قبول می‌شد. حالا
    // value !== false اضافه شده تا checkbox‌های required واقعاً checked باشند.
    const valid = value !== null && value !== undefined && value !== '' && value !== false &&
      (!Array.isArray(value) || value.length > 0);
    return { valid, error: valid ? null : 'این فیلد الزامی است', rule: 'required' };
  },
  email: (value) => {
    if (!value) return { valid: true, error: null };
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    return { valid, error: valid ? null : 'فرمت ایمیل نامعتبر است', rule: 'email' };
  },
  url: (value) => {
    if (!value) return { valid: true, error: null };
    try { new URL(String(value)); return { valid: true, error: null }; }
    catch { return { valid: false, error: 'فرمت URL نامعتبر است', rule: 'url' }; }
  },
  min: (value, _all, param) => {
    // FIX (v1.2.3): coerce numeric strings. قبلاً value رشته‌ای عددی (مثل '5')
    // با typeof !== 'number' به‌صورت length-based بررسی می‌شد. حالا اگر value
    // numeric string باشد، به number تبدیل و با threshold مقایسه می‌شود.
    const n = Number(param);
    const numericValue = typeof value === 'string' && value !== '' && !isNaN(Number(value))
      ? Number(value)
      : value;
    if (typeof numericValue === 'number') {
      const valid = numericValue >= n;
      return { valid, error: valid ? null : `مقدار باید حداقل ${n} باشد`, rule: 'min' };
    }
    const len = String(value || '').length;
    return { valid: len >= n, error: len >= n ? null : `حداقل ${n} کاراکتر`, rule: 'min' };
  },
  max: (value, _all, param) => {
    // FIX (v1.2.3): coerce numeric strings (مانند min).
    const n = Number(param);
    const numericValue = typeof value === 'string' && value !== '' && !isNaN(Number(value))
      ? Number(value)
      : value;
    if (typeof numericValue === 'number') {
      const valid = numericValue <= n;
      return { valid, error: valid ? null : `مقدار باید حداکثر ${n} باشد`, rule: 'max' };
    }
    const len = String(value || '').length;
    return { valid: len <= n, error: len <= n ? null : `حداکثر ${n} کاراکتر`, rule: 'max' };
  },
  pattern: (value, _all, param) => {
    if (!value) return { valid: true, error: null };
    // SEC FIX (v1.2.6): SEC-A11 — ReDoS guard. `pattern:` is intended for
    // developer-authored static patterns declared in the form schema. It is
    // NOT a free-form user-input sandbox. Even so, a carelessly authored
    // pattern (e.g. `(a+)+$`) run against a long attacker-controlled string
    // can blow up to O(2^n) backtrack time and freeze the page. Cap the
    // input length at 1000 characters before testing — anything longer is
    // not a normal form field value and should be rejected by a `max:` rule
    // anyway. This keeps regex evaluation bounded.
    const strValue = String(value);
    const MAX_PATTERN_INPUT = 1000;
    if (strValue.length > MAX_PATTERN_INPUT) {
      return { valid: false, error: `ورودی برای pattern بیش از حد طولانی است (حداکثر ${MAX_PATTERN_INPUT} کاراکتر)`, rule: 'pattern' };
    }
    try {
      const regex = new RegExp(param || '');
      const valid = regex.test(strValue);
      return { valid, error: valid ? null : 'فرمت نامعتبر', rule: 'pattern' };
    } catch {
      return { valid: false, error: 'الگوی نامعتبر', rule: 'pattern' };
    }
  },
  equals: (value, _all, param) => {
    // FIX (v1.2.3): type coercion. قبلاً param همیشه string بود و مقایسه با
    // value===param فقط برای string‌ها کار می‌کرد. حالا اگر param عددی یا
    // boolean باشد، به نوع مناسب تبدیل و سپس مقایسه می‌شود.
    let coercedParam: any = param;
    if (param === 'true') coercedParam = true;
    else if (param === 'false') coercedParam = false;
    else if (param !== '' && !isNaN(Number(param))) coercedParam = Number(param);
    const valid = value === coercedParam;
    return { valid, error: valid ? null : 'مقدار نامعتبر', rule: 'equals' };
  },
  // FEATURE (v1.0.0): Cross-field — بررسی تطابق دو فیلد (password confirm).
  equalsField: (value, allValues, param) => {
    const other = allValues[param || ''];
    const valid = value === other;
    return { valid, error: valid ? null : 'مقادیر مطابقت ندارند', rule: 'equalsField' };
  },
  // FEATURE (v1.0.0): Cross-field — بررسی تفاوت دو فیلد.
  differentFrom: (value, allValues, param) => {
    const other = allValues[param || ''];
    const valid = value !== other;
    return { valid, error: valid ? null : 'مقادیر نباید یکسان باشند', rule: 'differentFrom' };
  },
  // FEATURE (v1.0.0): Cross-field — فیلد دیگری الزامی است اگر این فیلد پر شده.
  requiresField: (value, allValues, param) => {
    if (!value) return { valid: true, error: null };
    const other = allValues[param || ''];
    const valid = other !== null && other !== undefined && other !== '';
    return { valid, error: valid ? null : `این فیلد به «${param}» نیاز دارد`, rule: 'requiresField' };
  },
  // ─ـ Advanced rules ──
  number: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return { valid: !isNaN(Number(value)), error: !isNaN(Number(value)) ? null : 'باید عدد باشد', rule: 'number' };
  },
  integer: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    const n = Number(value);
    return { valid: Number.isInteger(n), error: Number.isInteger(n) ? null : 'باید عدد صحیح باشد', rule: 'integer' };
  },
  positive: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return { valid: Number(value) > 0, error: Number(value) > 0 ? null : 'باید مثبت باشد', rule: 'positive' };
  },
  negative: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return { valid: Number(value) < 0, error: Number(value) < 0 ? null : 'باید منفی باشد', rule: 'negative' };
  },
  date: (value) => {
    if (!value) return { valid: true, error: null };
    const d = new Date(value);
    return { valid: !isNaN(d.getTime()), error: !isNaN(d.getTime()) ? null : 'تاریخ نامعتبر', rule: 'date' };
  },
  phone: (value) => {
    if (!value) return { valid: true, error: null };
    const valid = /^[\d\s\+\-\(\)]{7,20}$/.test(String(value));
    return { valid, error: valid ? null : 'شماره تلفن نامعتبر', rule: 'phone' };
  },
  creditCard: (value) => {
    if (!value) return { valid: true, error: null };
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return { valid: false, error: 'شماره کارت نامعتبر', rule: 'creditCard' };
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let n = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return { valid: sum % 10 === 0, error: sum % 10 === 0 ? null : 'شماره کارت نامعتبر', rule: 'creditCard' };
  },
  // FEATURE (v1.0.0): Persian National ID (کد ملی)
  nationalId: (value) => {
    if (!value) return { valid: true, error: null };
    const code = String(value).replace(/\D/g, '');
    if (code.length !== 10) return { valid: false, error: 'کد ملی باید ۱۰ رقم باشد', rule: 'nationalId' };
    if (/^(\d)\1{9}$/.test(code)) return { valid: false, error: 'کد ملی نامعتبر', rule: 'nationalId' };
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
    const remainder = sum % 11;
    const check = Number(code[9]);
    const valid = (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
    return { valid, error: valid ? null : 'کد ملی نامعتبر', rule: 'nationalId' };
  },
  // FEATURE (v1.0.0): Persian phone number
  persianPhone: (value) => {
    if (!value) return { valid: true, error: null };
    const valid = /^09\d{9}$/.test(String(value).replace(/\s/g, ''));
    return { valid, error: valid ? null : 'شماره موبایل باید ۱۱ رقم و با 09 شروع شود', rule: 'persianPhone' };
  },
};

const customRules = new Map<string, ValidationRule>();
const asyncRules = new Map<string, AsyncValidationRule>();

export function defineRule(name: string, fn: ValidationRule): void {
  customRules.set(name, fn);
}

/** ثبت یک قانون async (مثل بررسی uniqueness از سرور). */
export function defineAsyncRule(name: string, fn: AsyncValidationRule): void {
  asyncRules.set(name, fn);
}

function parseRules(rulesStr: string): Array<{ name: string; param?: string }> {
  return rulesStr.split(',').map(r => r.trim()).filter(r => r.length > 0).map(r => {
    const [name, ...rest] = r.split(':');
    return { name: (name ?? '').trim(), param: rest.join(':') || undefined };
  });
}

// ── FEATURE (v1.0.0): Nested value access (dot notation) ──

/**
 * دریافت مقدار یک فیلد با پشتیبانی از dot notation.
 * مثلاً "address.city" → values.address.city
 */
export function getNestedValue(values: Record<string, any>, path: string): any {
  if (!path.includes('.')) return values[path];
  const parts = path.split('.');
  let current: any = values;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * تنظیم مقدار یک فیلد با پشتیبانی از dot notation.
 */
export function setNestedValue(values: Record<string, any>, path: string, value: any): Record<string, any> {
  if (!path.includes('.')) {
    return { ...values, [path]: value };
  }
  const parts = path.split('.');
  const result = { ...values };
  let current: any = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    } else {
      current[part] = { ...current[part] };
    }
    current = current[part];
  }
  current[parts[parts.length - 1]!] = value;
  return result;
}

/**
 * ساخت یک flat object از nested values برای validation.
 * مثلاً { address: { city: 'Tehran' } } → { 'address.city': 'Tehran' }
 */
export function flattenValues(values: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(values)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenValues(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ── Validation Functions ──

export function validateField(value: any, rulesStr: string, allValues: Record<string, any> = {}): FieldValidation {
  if (!rulesStr) return { valid: true, error: null };
  const rules = parseRules(rulesStr);
  for (const { name, param } of rules) {
    const ruleFn = builtinRules[name] || customRules.get(name);
    if (!ruleFn) {
      console.warn(`[Zenith Form] Unknown validation rule: "${name}"`);
      continue;
    }
    const result = ruleFn(value, allValues, param);
    if (!result.valid) return result;
  }
  return { valid: true, error: null };
}

/**
 * اعتبارسنجی async یک فیلد (برای rules مثل uniqueness).
 *
 * FEATURE (v1.0.0): پشتیبانی از AbortSignal برای لغو درخواست‌های قبلی.
 */
export async function validateFieldAsync(
  value: any,
  rulesStr: string,
  allValues: Record<string, any> = {},
  signal?: AbortSignal,
): Promise<FieldValidation> {
  if (!rulesStr) return { valid: true, error: null };
  const rules = parseRules(rulesStr);

  // First run sync rules.
  const syncResult = validateField(value, rulesStr, allValues);
  if (!syncResult.valid) return syncResult;

  // Then run async rules.
  for (const { name, param } of rules) {
    // Check if aborted.
    if (signal?.aborted) return { valid: true, error: null };

    const asyncFn = asyncRules.get(name);
    if (asyncFn) {
      const result = await asyncFn(value, allValues, param, signal);
      if (!result.valid) return result;
    }
  }

  return { valid: true, error: null };
}

/**
 * اعتبارسنجی کل فرم با پشتیبانی از nested fields (dot notation).
 *
 * FEATURE (v1.0.0): rules با کلیدهای dot notation پشتیبانی می‌شوند.
 * مثلاً { 'address.city': 'required', 'address.zip': 'required,min:5' }
 */
export function validateForm(values: Record<string, any>, rules: Record<string, string>): FormValidation {
  const fields: Record<string, FieldValidation> = {};

  // Flatten nested values for cross-field validation.
  const flatValues = flattenValues(values);

  for (const [fieldName, rulesStr] of Object.entries(rules)) {
    // Get value using dot notation.
    const value = getNestedValue(values, fieldName);
    // Use flat values for cross-field validation.
    fields[fieldName] = validateField(value, rulesStr, flatValues);
  }

  return { valid: Object.values(fields).every(f => f.valid), fields };
}

/**
 * اعتبارسنجی async کل فرم.
 */
export async function validateFormAsync(
  values: Record<string, any>,
  rules: Record<string, string>,
  signal?: AbortSignal,
): Promise<FormValidation> {
  const fields: Record<string, FieldValidation> = {};
  const flatValues = flattenValues(values);

  for (const [fieldName, rulesStr] of Object.entries(rules)) {
    if (signal?.aborted) break;

    const value = getNestedValue(values, fieldName);
    fields[fieldName] = await validateFieldAsync(value, rulesStr, flatValues, signal);
  }

  return { valid: Object.values(fields).every(f => f.valid), fields };
}

export function clearCustomRules(): void {
  customRules.clear();
  asyncRules.clear();
}

// ── FEATURE (v1.0.0): Form-level Validation Lifecycle ──

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
export async function validateWithLifecycle(
  values: Record<string, any>,
  rules: Record<string, string>,
  lifecycle: FormValidationLifecycle,
  async: boolean = false,
): Promise<FormValidation> {
  // onBeforeValidate
  if (lifecycle.onBeforeValidate) {
    const shouldContinue = await lifecycle.onBeforeValidate(values);
    if (!shouldContinue) {
      return { valid: true, fields: {} };
    }
  }

  // Run validation
  const result = async ? await validateFormAsync(values, rules) : validateForm(values, rules);

  // onAfterValidate
  if (lifecycle.onAfterValidate) {
    lifecycle.onAfterValidate(result, values);
  }

  // onFieldError / onFormValid / onFormInvalid
  if (!result.valid) {
    const flatValues = flattenValues(values);
    if (lifecycle.onFieldError) {
      for (const [name, field] of Object.entries(result.fields)) {
        if (!field.valid && field.error) {
          lifecycle.onFieldError(name, field.error, flatValues);
        }
      }
    }
    if (lifecycle.onFormInvalid) {
      lifecycle.onFormInvalid(result, values);
    }
  } else {
    if (lifecycle.onFormValid) {
      lifecycle.onFormValid(values);
    }
  }

  return result;
}

// ── Schema System ──

export interface SchemaField {
  initial?: any;
  rules?: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'checkbox' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export interface FormSchema {
  fields: Record<string, SchemaField>;
  submitLabel?: string;
  /** FEATURE (v1.0.0): Nested schema برای sub-forms. */
  nested?: Record<string, FormSchema>;
}

export function schemaToFormConfig(schema: FormSchema): Record<string, { initial: any; rules?: string }> {
  const config: Record<string, { initial: any; rules?: string }> = {};
  for (const [name, field] of Object.entries(schema.fields)) {
    config[name] = {
      initial: field.initial ?? (field.type === 'checkbox' ? false : ''),
      rules: field.rules,
    };
  }
  // FEATURE (v1.0.0): Nested schema support.
  if (schema.nested) {
    for (const [group, nestedSchema] of Object.entries(schema.nested)) {
      const nestedConfig = schemaToFormConfig(nestedSchema);
      for (const [key, val] of Object.entries(nestedConfig)) {
        config[`${group}.${key}`] = val;
      }
    }
  }
  return config;
}

/**
 * FIX (v1.2.3): escape کاراکترهای HTML برای جلوگیری از XSS در schemaToHtml.
 * قبلاً label/placeholder/option.value/option.label مستقیماً در رشته‌ی HTML
 * قرار می‌گرفتند که اگر کاربر رشته‌ای با <script> در label داشت، XSS رخ می‌داد.
 */
function escapeHTML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function schemaToHtml(schema: FormSchema, formVar = '$form'): string {
  const lines: string[] = [];
  for (const [name, field] of Object.entries(schema.fields)) {
    // FIX (v1.2.3): escape label و placeholder برای جلوگیری از XSS.
    const label = escapeHTML(field.label || name);
    const rules = field.rules || '';
    const placeholder = escapeHTML(field.placeholder || '');
    const modelExpr = `${formVar}.fields.${name}.value`;

    lines.push(`<div class="form-field">`);
    lines.push(`  <label>${label}</label>`);

    if (field.type === 'select' && field.options) {
      lines.push(`  <select zen-model="${modelExpr}">`);
      for (const opt of field.options) {
        // FIX (v1.2.3): escape option value و label.
        lines.push(`    <option value="${escapeHTML(opt.value)}">${escapeHTML(opt.label)}</option>`);
      }
      lines.push(`  </select>`);
    } else if (field.type === 'textarea') {
      lines.push(`  <textarea zen-model="${modelExpr}" placeholder="${placeholder}"></textarea>`);
    } else if (field.type === 'checkbox') {
      lines.push(`  <input type="checkbox" zen-model="${modelExpr}">`);
    } else {
      lines.push(`  <input type="${field.type || 'text'}" zen-model="${modelExpr}" zen-validate="${rules}" placeholder="${placeholder}">`);
    }

    lines.push(`  <span zen-if="!${formVar}.fields.${name}.validation.valid && ${formVar}.fields.${name}.touched" class="error">`);
    lines.push(`    <span zen-text="${formVar}.fields.${name}.validation.error"></span>`);
    lines.push(`  </span>`);
    lines.push(`</div>`);
  }

  lines.push(`<button zen-action:submit.prevent="formSubmit" zen-bind:disabled="!${formVar}.valid">${escapeHTML(schema.submitLabel || 'Submit')}</button>`);
  return lines.join('\n');
}
