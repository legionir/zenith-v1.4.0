# گزارش حسابرسی پکیج `form`
**نسخه:** v1.3.0 | **بسته:** `@zenith/form`

---

## ۱. خلاصه پکیج

پکیج `form` سیستم مدیریت فرم‌های فریم‌ورک Zenith است. این پکیج یک `FormStore` کلاس Signal-based با اعتبارسنجی async، debounced validation (۳۰۰ms)، cross-field validation (equalsField/differentFrom/requiresField)، آداپتورهای Zod/JSON Schema، و مدیریت لغو خودکار با AbortController ارائه می‌دهد.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/form.ts` | ~۴۵۰+ | `FormStore` کلاس – مدیریت state، اعتبارسنجی، submit، destroy |
| `src/validator.ts` | ~۴۰۰+ | قوانین اعتبارسنجی داخلی، custom rule registry، `validateField`/`validateForm` |
| `src/schema.ts` | ~۱۵۰ | `fromZod` (قابلیت Zod v1.2.3), `fromJsonSchema`, `createFormFromSchema` |
| `src/index.ts` | ~۲۰ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-FRM-01: `equalsField` cross-field validation در تغییر فیلد دوم به‌روز نمی‌شود
- **شدت:** بالا
- **محل:** `src/validator.ts` – قانون `equalsField`
- **شرح:** قانون `equalsField('password', 'confirmPassword')` روی فیلد `confirmPassword` تنظیم شده است. اگر کاربر مقدار `password` را تغییر دهد، خطای `confirmPassword` به‌روز نمی‌شود تا زمانی که کاربر دوباره در `confirmPassword` تایپ کند.
- **نحوه رفع:** ایجاد subscription خودکار بین فیلدهای وابسته:

```typescript
export const rules = {
  equalsField(fieldName: string, errorMessage?: string): ValidationRule {
    return {
      validate(value: any, context: Record<string, any>) {
        if (value !== context[fieldName]) {
          return errorMessage ?? `باید برابر با ${fieldName} باشد`;
        }
        return null;
      },
      // NEW: معرفی فیلدهای وابسته برای re-validation خودکار
      get watchFields() {
        return [fieldName];
      },
    };
  },
};

// در FormStore:
setFieldValue(field: string, value: any): void {
  // ... به‌روزرسانی مقدار
  // پیدا کردن فیلدهایی که به این فیلد وابسته هستند
  const dependentFields = this._findDependentFields(field);
  for (const dep of dependentFields) {
    this._revalidateField(dep);
  }
}
```

### BUG-FRM-02: async validation race condition با BUG-03 ممکن است همچنان وجود داشته باشد
- **شدت:** بالا
- **محل:** `src/form.ts` – BUG-03 fix (AbortController)
- **شرح:** BUG-03 از AbortController برای لغو اعتبارسنجی قبلی استفاده کرده است. اما اگر اعتبارسنجی اولی قبل از دریافت سیگنال abort کامل شود، ممکن است نتیجه‌ی آن به‌جای اعتبارسنجی جدید اعمال شود.
- **نحوه رفع:** استفاده از generation counter:

```typescript
export class FormStore {
  private _validationGeneration = 0;

  async _validateField(field: string): Promise<void> {
    const gen = ++this._validationGeneration;
    this._abortController?.abort();
    this._abortController = new AbortController();

    try {
      const errors = await validateField(field, this._values, {
        signal: this._abortController.signal,
      });

      // فقط اگر generation تغییری نکرده باشد
      if (gen === this._validationGeneration) {
        this._fieldErrors[field] = errors;
        this._notify();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // نادیده گرفتن
      }
      if (gen === this._validationGeneration) {
        this._fieldErrors[field] = ['خطا در اعتبارسنجی'];
        this._notify();
      }
    }
  }
}
```

### BUG-FRM-03: `pushItem`/`removeItem`/`moveItem` array operations index validation ندارند
- **شدت:** متوسط
- **محل:** `src/form.ts`
- **شرح:** متدهای مدیریت آرایه مانند `moveItem(field, fromIndex, toIndex)` if `fromIndex` یا `toIndex` خارج از محدوده آرایه باشند، خطای unclear ایجاد می‌شود.
- **نحوه رفع:**

```typescript
moveItem(field: string, fromIndex: number, toIndex: number): void {
  const arr = this._values[field];
  if (!Array.isArray(arr)) {
    console.error(`[Zenith] Field "${field}" is not an array`);
    return;
  }
  if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) {
    console.error(`[Zenith] Invalid indices: from=${fromIndex}, to=${toIndex}, length=${arr.length}`);
    return;
  }
  const newArr = [...arr];
  const [item] = newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, item);
  this.setFieldValue(field, newArr);
}
```

### BUG-FRM-04: `submit()` بدون validation قبلی، فرم ناقص را ارسال می‌کند
- **شدت:** متوسط
- **محل:** `src/form.ts` – متد `submit()`
- **شرح:** اگر کاربر بلافاصله فرم را submit کند (بدون اینکه validation انجام شود)، `submit()` ممکن است فرم را با خطاهای نامشخص ارسال کند.
- **نحوه رفع:** `submit()` باید ابتدا کل فرم را validate کند:

```typescript
async submit(): Promise<SubmitResult | null> {
  // ابتدا کل فرم را اعتبارسنجی کن
  const errors = await this.validate();
  if (errors && Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  // سپس submit کن
  return this._doSubmit();
}
```

### BUG-FRM-05: debounce (300ms) برای همه فیلدها یکسان است
- **شدت:** کم
- **محل:** `src/form.ts`
- **شرح:** debounce به صورت ثابت ۳۰۰ms برای همه فیلدها تنظیم شده است. برخی فیلدها (مثلاً شماره تلفن) نیاز به debounce کوتاه‌تر دارند.
- **نحوه رفع:** پشتیبانی از debounce per-field:

```typescript
setFieldDebounce(field: string, ms: number): void {
  this._fieldDebounce[field] = ms;
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-FRM-01: افزودن dirty/pristine tracking
- **دلیل:** اطلاع از تغییر وضعیت فیلدها برای UI feedback.
- **پیاده‌سازی:**

```typescript
export class FormStore {
  private _dirty = new Set<string>();
  private _initialValues: Record<string, any>;

  get isDirty(): boolean { return this._dirty.size > 0; }
  get isFieldDirty(field: string): boolean { return this._dirty.has(field); }

  setFieldValue(field: string, value: any): void {
    if (value !== this._initialValues[field]) {
      this._dirty.add(field);
    } else {
      this._dirty.delete(field);
    }
    // ...
  }

  reset(): void {
    this._dirty.clear();
    this._values = { ...this._initialValues };
  }
}
```

### IMP-FRM-02: افزودن touched/blur tracking
- **دلیل:** نمایش خطاها فقط بعد از اینکه کاربر فیلد را لمس کرد.

```typescript
get isFieldTouched(field: string): boolean { return this._touched.has(field); }

markFieldTouched(field: string): void {
  this._touched.add(field);
  this._validateField(field);
}
```

### IMP-FRM-03: افزودن FormArray برای مدیریت پویای آرایه‌ها
- **دلیل:** API بهینه‌تر برای فرم‌های dynamic (اضافه/حذف سطرها).

### IMP-FRM-04: پشتیبانی از async custom validators با dependencies عبوری
- **دلیل:** validators async که به state خارجی وابسته هستند.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `signal` در هسته FormStore برای reactivity. | ✅ درست |
| **runtime/context** | Form data از طریق context در expressionها. | ✅ درست |
| **runtime/directives/model** | `zen-model` دوطرفه با FormStore می‌تواند کار کند. | ✅ درست |
| **errors** | خطاهای فرم از طریق `reportError`. | ✅ درست |
| **validation (schema)** | پشتیبانی از Zod و JSON Schema. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `form` یکی از کامل‌ترین پکیج‌های فریم‌ورک است. اعتبارسنجی قوی با قابلیت cross-field validation و پشتیبانی از Zod از نقاط قوت آن است. با این حال، cross-field re-validation (BUG-FRM-01) و race condition در async validation (BUG-FRM-02) نیاز به رفع فوری دارند.

**امتیاز کلی: ۷.۵/۱۰** (کامل اما نیاز به رفع cross-field re-validation و race condition)
