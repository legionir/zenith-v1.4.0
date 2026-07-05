# گزارش حسابرسی پکیج `errors`
**نسخه:** v1.3.0 | **بسته:** `@zenith/errors`

---

## ۱. خلاصه پکیج

پکیج `errors` سیستم مدیریت خطاهای فریم‌ورک Zenith را پیاده‌سازی می‌کند. این پکیج کلاس `ZenithError` با کدهای خطای استاندارد (ZEN-001 تا ZEN-999)، دسته‌بندی خطاها، تشخیص غلط املایی با Levenshtein distance، و توابع کارخانه‌ای برای ایجاد خطاهای خاص را ارائه می‌دهد.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/index.ts` | ~۱۲۰+ | `ZenithError`, `ErrorCode`, دسته‌بندی‌ها، توابع کارخانه‌ای |
| (تست‌ها) | - | تست‌های واحد |

---

## ۳. باگ‌ها و مشکلات

### BUG-ERR-01: برخی کدهای خطا در مستندات/توابع کارخانه‌ای پوشش داده نشده‌اند
- **شدت:** کم
- **محل:** `src/index.ts`
- **شرح:** کدهای خطا از ZEN-001 تا ZEN-۹۰۱ تعریف شده‌اند اما بسیاری از آن‌ها تابع کارخانه‌ای ندارند. توسعه‌دهندگان مجبورند مستقیماً `new ZenithError(...)` بسازند که احتمال ناسازگاری را افزایش می‌دهد.
- **نحوه رفع:** ایجاد توابع کارخانه‌ای برای همه کدهای خطا:

```typescript
export const ErrorFactories = {
  [ErrorCode.RESOURCE_HTTP_ERROR]: (status: number, url: string) =>
    new ZenithError('ResourceError', `HTTP ${status}: ${url}`, { details: { status, url } }),

  [ErrorCode.COMPILER_SYNTAX_ERROR]: (source: string, line: number) =>
    new ZenithError('CompilerError', `Syntax error in ${source}:${line}`, { details: { source, line } }),

  // ... برای همه کدها
} as const;
```

### BUG-ERR-02: `context` در خطاها همیشه استفاده نمی‌شود
- **شدت:** کم
- **محل:** `src/index.ts`
- **شرح:** پارامتر `context` در سازنده `ZenithError` وجود دارد اما برخی فراخوان‌ها context مربوط (مانند component name, expression, element) را ارسال نمی‌کنند که دیباگ را سخت‌تر می‌کند.
- **نحوه رفع:** الزام به ارسال context در توابع کارخانه‌ای و ارتقای TypeScript:

```typescript
interface ErrorContext {
  component?: string;
  expression?: string;
  url?: string;
  field?: string;
  timestamp?: number;
}
```

### BUG-ERR-03: Levenshtein distance ممکن است برای واژه‌های کوتاه نتایج غیرمنتظره بدهد
- **شدت:** کم
- **محل:** `src/index.ts` – تابع Levenshtein
- **شرح:** الگوریتم Levenshtein distance استاندارد استفاده شده است. اما برای واژه‌های کوتاه (مثلاً ۲-۳ حرف)، بسیاری از کلمات distance کم دارند و suggestions بی‌ربط می‌شوند.
- **نحوه رفع:** افزودن آستانه نسبی:

```typescript
export function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance?: number,
): string[] {
  const threshold = maxDistance ?? Math.max(2, Math.floor(input.length / 3));
  const scored = candidates
    .map(c => ({ candidate: c, distance: levenshtein(input, c) }))
    .filter(x => x.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  return scored.slice(0, 3).map(x => x.candidate);
}
```

### BUG-ERR-04: `isZenithError` type guard ممکن است false positive بدهد
- **شدت:** کم
- **محل:** `src/index.ts`
- **شرح:** `isZenithError(err)` بررسی می‌کند که آیا `err instanceof ZenithError` است. اما در سناریوهای cross-realm (مانند iframe یا VM context در تست)، `instanceof` ممکن است fail کند.
- **نحوه رفع:** استفاده از duck typing:

```typescript
export function isZenithError(err: unknown): err is ZenithError {
  if (err instanceof ZenithError) return true;
  // Duck typing برای cross-realm
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return typeof e.code === 'string' && e.code.startsWith('ZEN-')
      && typeof e.category === 'string';
  }
  return false;
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-ERR-01: Error boundary ادغام با پکیج errors
- **دلیل:** `error-boundary` و `errors` هر دو مدیریت خطا را انجام می‌دهند اما اشتراک داده ندارند.
- **پیاده‌سازی:** انتقال `reportError` به پکیج `errors` و استفاده در `error-boundary`.

### IMP-ERR-02: افزودن ErrorCode.JS_VM_ERROR و پشتیبانی از خطاهای Expression
- **دلیل:** خطاهای runtime در expression evaluation.

### IMP-ERR-03: افزودن structured stack trace
- **دلیل:** stack trace قابل خواندن با اطلاعات خط و ستون.
- **پیاده‌سازی:**

```typescript
export class ZenithError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly details?: Record<string, unknown>;
  readonly timestamp: number;

  constructor(category: ErrorCategory, message: string, options?: {
    code?: ErrorCode;
    details?: Record<string, unknown>;
    cause?: Error;
  }) {
    super(message);
    this.name = 'ZenithError';
    this.code = options?.code ?? ErrorCode.INTERNAL_UNKNOWN;
    this.category = category;
    this.timestamp = Date.now();
    this.details = options?.details;
    this.cause = options?.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZenithError);
    }
  }
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **error-boundary** | از `reportError` برای مدیریت خطاهای UI استفاده می‌کند. | ✅ درست |
| **expressions** | خطاهای expression با `variableNotDefinedError`, `expressionSyntaxError` | ✅ درست |
| **resource** | خطاهای HTTP با `resourceHttpError` | ✅ درست |
| **runtime** | `reportError` در سراسر runtime استفاده می‌شود. | ✅ درست |
| **ssr** | `ssrEnvironmentError` برای خطاهای SSR | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `errors` یک لایه مدیریت خطای خوب و منسجم با کدگذاری ZEN-xxx است. Levenshtein distance برای تشخیص غلط املایی یک قابلیت عالی است. مهم‌ترین کمبود: نبود توابع کارخانه‌ای برای همه کدهای خطا (باعث ناسازگاری) و potential false positive در `isZenithError` برای cross-realm.

**امتیاز کلی: ۸/۱۰** (سیستم منسجم و مفید، نیاز به تکمیل توابع کارخانه‌ای)
