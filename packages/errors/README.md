# @zenith/errors — Error Messages Library

کتابخانه‌ی پیام‌های خطای Zenith با کدهای منظم (سه‌رقمی کلاسیک + بازه‌های ۴رقمی پکیج‌های جدید، #171/DEC-020)، پیشنهادهای فارسی، docsUrl و test coverage.

## نصب

```bash
npm install @zenith/errors
# یا
bun add @zenith/errors
```

## استفاده

```typescript
import { variableNotDefinedError, ZenithError, isZenithError } from '@zenith/errors';

try {
  evaluateExpression('$usr', context);
} catch (err) {
  if (isZenithError(err)) {
    console.error(err.toUserString());
    // ❌ [ZEN-001] Expression: متغیر «$usr» در context تعریف نشده است.
    //
    // 💡 پیشنهاد: آیا منظور شما «$user» بود؟ (اصلاح املا)
    //
    // 🔍 جزئیات: { "availableVariables": ["$user"], "suggestedVariable": "$user" }
  }
}
```

## کدهای خطا

| Range              | Category               | Example Codes                                                |
| ------------------ | ---------------------- | ------------------------------------------------------------ |
| ZEN-001 to ZEN-099 | Expression / Validator | ZEN-001 (variable not defined), ZEN-002 (forbidden property) |
| ZEN-100 to ZEN-199 | Runtime / Directive    | ZEN-101 (zen-for no zen-key), ZEN-102 (invalid syntax)       |
| ZEN-200 to ZEN-299 | Resource               | ZEN-201 (destroyed), ZEN-202 (HTTP error)                    |
| ZEN-300 to ZEN-399 | SSR                    | ZEN-301 (jsdom required), ZEN-303 (ALS unavailable)          |
| ZEN-400 to ZEN-499 | Security               | ZEN-401 (XSS blocked)                                        |
| ZEN-500 to ZEN-599 | Compiler               | ZEN-501 (unknown directive)                                  |
| ZEN-600 to ZEN-699 | Router                 | ZEN-601 (route not found)                                    |
| ZEN-700 to ZEN-799 | Form                   | ZEN-701 (validation failed)                                  |
| ZEN-800 to ZEN-899 | Component              | ZEN-801 (slot not found)                                     |
| ZEN-900 to ZEN-999 | Internal               | ZEN-901 (unknown)                                            |

### بازه‌های ۴رقمی (پکیج‌های جدید — #171، DEC-020)

کدهای سه‌رقمی موجود هرگز renumber نمی‌شوند. جدول `ERROR_CODE_RANGES`:

| بازه | دامنه | بازه | دامنه |
| --- | --- | --- | --- |
| 1000–1099 | schema | 1800–1899 | adapters / ssg |
| 1100–1199 | storage | 1900–1999 | analytics |
| 1200–1299 | cache | 2000–2099 | theme |
| 1300–1399 | i18n / jalali | 2100–2199 | auth-oauth |
| 1400–1499 | a11y | 2200–2299 | feature-flags |
| 1500–1599 | head | 2300–2399 | createApp / runtime-core |
| 1600–1699 | ui | 2400–2499 | devtools-core |
| 1700–1799 | realtime | 2500–2599 | tooling (cli / unplugin / mock) |

`ZEN-DEPR-xxx` — فضای هشدارهای deprecation (DEC-019؛ رجیستری `DEPRECATION_CODES`؛ حذف در ۲.۰ طبق DEC-026).

### API بازه‌ها (#171)

- `ERROR_CODE_PATTERN` — الگوی رسمی `ZEN-NNN | ZEN-NNNN | ZEN-DEPR-NNN`
- `RESERVED_ERROR_CODES` — کاتالوگ کدهای رزورشده با message فارسی + suggestion + domain
- `createReservedError(code, { details?, context?, cause? })` — ZenithError کامل با `docsUrl` (خطا اگر code ثبت‌نشده باشد)
- `errorDocsUrl(code)` — `https://zenith.dev/errors/<code>`
- `ERROR_CODE_RANGES` / `DEPRECATION_CODES` — جدول‌های مرجع

## API

### `ZenithError`

کلاس پایه برای تمام خطاهای Zenith.

```typescript
class ZenithError extends Error {
  code: string; // "ZEN-001"
  category: ErrorCategory; // "Expression"
  suggestion?: string; // راهنمای رفع
  details?: Record<string, unknown>; // جزئیات دیباگ
  context?: Record<string, unknown>; // context در زمان خطا
  docsUrl?: string; // لینک مستندات (createReservedError خودکار ست می‌کند)

  toUserString(): string; // فرمت کاربرپسند
  toJSON(): Record<string, unknown>; // فرمت API
}
```

### Factory Functions

- `variableNotDefinedError(varName, availableVars)` — با typo detection
- `zenForNoZenKeyError(expr)` — با مثال `zen-key="item.id"`
- `zenForInvalidSyntaxError(expr)` — با مثال‌های سینتکس صحیح
- `resourceDestroyedError(name, operation, stack?)` — با stack trace
- `ssrEnvironmentError(issue)` — با تشخیص محیط (browser/Node)
- `securityError(code, property, isRuntime)` — با راهنمای امنیتی
- `resourceHttpError(url, status, statusText)` — با راهنمای HTTP
- `expressionSyntaxError(expr, position, token)` — با مثال‌های معتبر

### Utilities

- `findClosestMatch(input, candidates)` — Levenshtein distance typo detection
- `isZenithError(err)` — type guard
- `toZenithError(err)` — تبدیل هر خطایی به ZenithError

## تست‌ها

```bash
cd tests/v1.0
bun -e "import('./error-messages/error-messages.test.js').then(m => m.run())"
```

۴۲ تست — همه pass.
