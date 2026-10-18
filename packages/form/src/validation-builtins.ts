import type { FieldValidationRule } from './validation-types';
export const builtinRules: Record<string, FieldValidationRule> = {
  required: (value) => {
    // FIX (v1.2.3): قبلاً `false` برای checkbox‌های required قبول می‌شد. حالا
    // value !== false اضافه شده تا checkbox‌های required واقعاً checked باشند.
    const valid =
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== false &&
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
    try {
      new URL(String(value));
      return { valid: true, error: null };
    } catch {
      return { valid: false, error: 'فرمت URL نامعتبر است', rule: 'url' };
    }
  },
  min: (value, _all, param) => {
    // FIX (v1.2.3): coerce numeric strings. قبلاً value رشته‌ای عددی (مثل '5')
    // با typeof !== 'number' به‌صورت length-based بررسی می‌شد. حالا اگر value
    // numeric string باشد، به number تبدیل و با threshold مقایسه می‌شود.
    const n = Number(param);
    const numericValue =
      typeof value === 'string' && value !== '' && !isNaN(Number(value)) ? Number(value) : value;
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
    const numericValue =
      typeof value === 'string' && value !== '' && !isNaN(Number(value)) ? Number(value) : value;
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
      return {
        valid: false,
        error: `ورودی برای pattern بیش از حد طولانی است (حداکثر ${MAX_PATTERN_INPUT} کاراکتر)`,
        rule: 'pattern',
      };
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
    let coercedParam: unknown = param;
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
    return {
      valid,
      error: valid ? null : `این فیلد به «${param}» نیاز دارد`,
      rule: 'requiresField',
    };
  },
  // ─ـ Advanced rules ──
  number: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return {
      valid: !isNaN(Number(value)),
      error: !isNaN(Number(value)) ? null : 'باید عدد باشد',
      rule: 'number',
    };
  },
  integer: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    const n = Number(value);
    return {
      valid: Number.isInteger(n),
      error: Number.isInteger(n) ? null : 'باید عدد صحیح باشد',
      rule: 'integer',
    };
  },
  positive: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return {
      valid: Number(value) > 0,
      error: Number(value) > 0 ? null : 'باید مثبت باشد',
      rule: 'positive',
    };
  },
  negative: (value) => {
    if (!value && value !== 0) return { valid: true, error: null };
    return {
      valid: Number(value) < 0,
      error: Number(value) < 0 ? null : 'باید منفی باشد',
      rule: 'negative',
    };
  },
  date: (value) => {
    if (!value) return { valid: true, error: null };
    // Preserve native Date coercion for untyped input, without claiming it is a string.
    const d: Date = Reflect.construct(Date, [value]);
    return {
      valid: !isNaN(d.getTime()),
      error: !isNaN(d.getTime()) ? null : 'تاریخ نامعتبر',
      rule: 'date',
    };
  },
  phone: (value) => {
    if (!value) return { valid: true, error: null };
    const valid = /^[\d\s+()-]{7,20}$/.test(String(value));
    return { valid, error: valid ? null : 'شماره تلفن نامعتبر', rule: 'phone' };
  },
  creditCard: (value) => {
    if (!value) return { valid: true, error: null };
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19)
      return { valid: false, error: 'شماره کارت نامعتبر', rule: 'creditCard' };
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let n = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    }
    return {
      valid: sum % 10 === 0,
      error: sum % 10 === 0 ? null : 'شماره کارت نامعتبر',
      rule: 'creditCard',
    };
  },
  // FEATURE (v1.0.0): Persian National ID (کد ملی)
  nationalId: (value) => {
    if (!value) return { valid: true, error: null };
    const code = String(value).replace(/\D/g, '');
    if (code.length !== 10)
      return { valid: false, error: 'کد ملی باید ۱۰ رقم باشد', rule: 'nationalId' };
    if (/^(\d)\1{9}$/.test(code))
      return { valid: false, error: 'کد ملی نامعتبر', rule: 'nationalId' };
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
    const remainder = sum % 11;
    const check = Number(code[9]);
    const valid =
      (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
    return { valid, error: valid ? null : 'کد ملی نامعتبر', rule: 'nationalId' };
  },
  // FEATURE (v1.0.0): Persian phone number
  persianPhone: (value) => {
    if (!value) return { valid: true, error: null };
    const valid = /^09\d{9}$/.test(String(value).replace(/\s/g, ''));
    return {
      valid,
      error: valid ? null : 'شماره موبایل باید ۱۱ رقم و با 09 شروع شود',
      rule: 'persianPhone',
    };
  },
};

