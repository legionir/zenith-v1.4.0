# گزارش حسابرسی پکیج `permission`
**نسخه:** v1.3.0 | **بسته:** `@zenith/permission`

---

## ۱. خلاصه پکیج

پکیج `permission` سیستم کنترل دسترسی (Authorization) فریم‌ورک Zenith را پیاده‌سازی می‌کند. از دو رویکرد RBAC (نقش‌محور) و Permission-based (مجوز محور) پشتیبانی می‌کند. دارای قابلیت `freeze()` برای جلوگیری از تغییر مجوزها پس از XSS (SEC-A7)، fail-closed guards (SEC-A5)، و سینتکس `any(...)/all(...)` برای جلوگیری از تداخل با پیشوند `any:` (SEC-A6) است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/permission.ts` | ~۳۵۰+ | `PermissionManager` – مدیریت نقش‌ها و مجوزها |
| `src/directive.ts` | ~۶۰ | `processPermission`/`processRole` – پردازش دایرکتیوهای HTML |
| `src/index.ts` | ~۱۵ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-PRM-01: `freeze()` با Object.freeze قابل bypass است
- **شدت:** بالا
- **محل:** `src/permission.ts` – SEC-A7 fix
- **شرح:** SEC-A7 از `Object.freeze` برای جلوگیری از تغییر مجوزها استفاده می‌کند. اما `Object.freeze` shallow است و اگر مجوزها ساختار nested داشته باشند، nested objects همچنان قابل تغییر هستند. همچنین اگر کد مخرب دسترسی به prototype داشته باشد، می‌تواند freeze را دور بزند.
- **نحوه رفع:** استفاده از deep freeze:

```typescript
export function deepFreeze<T extends object>(obj: T): T {
  const propNames = Reflect.ownKeys(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

class PermissionManager {
  freeze(): void {
    this._permissions = deepFreeze(this._permissions);
    this._frozen = true;
  }
}
```

### BUG-PRM-02: `any(...)/all(...)` parsing (SEC-A6) برای توکن‌های تو در تو
- **شدت:** متوسط
- **محل:** `src/permission.ts` – SEC-A6 fix
- **شرح:** سینتکس `any(...)/all(...)` با یک regex ساده parse می‌شود. اگر یک `any(...)` شامل `any(...)` دیگر باشد (nested)، regex ممکن است اشتباه عمل کند.
- **نحوه رفع:** استفاده از parser واقعی با شمارش پرانتز:

```typescript
function parseExpression(expr: string): PermissionExpression {
  const trimmed = expr.trim();
  if (trimmed.startsWith('any(') && trimmed.endsWith(')')) {
    const inner = extractParentheses(trimmed.slice(4, -1));
    return { type: 'any', items: inner.split(',').map(s => parseExpression(s.trim())) };
  }
  // ...
}

function extractParentheses(str: string): string {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    if (depth < 0) return str.slice(0, i);
  }
  return str;
}
```

### BUG-PRM-03: `createGuard` fail-closed (SEC-A5) در خطاهای غیرمنتظره
- **شدت:** متوسط
- **محل:** `src/permission.ts` – SEC-A5 fix
- **شرح:** SEC-A5 fail-closed را پیاده‌سازی کرده است (در صورت خطا، دسترسی رد می‌شود). اما اگر تابع `checkPermission` خود خطا پرتاب کند (ناشی از استثنای غیرمنتظره)، این خطا توسط guard گرفته نمی‌شود و bubble می‌کند.
- **نحوه رفع:** افزودن try/catch به `checkPermission`:

```typescript
checkPermission(permission: string): boolean {
  try {
    if (this._frozen) {
      return this._permissions.has(permission);
    }
    return this._permissions.has(permission);
  } catch {
    // Fail-closed: در صورت خطا، دسترسی رد شود
    return false;
  }
}
```

### BUG-PRM-04: نبود مکانیزم پویا برای به‌روزرسانی مجوزها
- **شدت:** کم
- **محل:** `src/permission.ts`
- **شرح:** پس از `freeze()`، هیچ راهی برای به‌روزرسانی مجوزها وجود ندارد (که هدف freeze هم همین است). اما در سناریوهای واقعی، ممکن است مجوزهای کاربر پس از لاگین مجدد تغییر کند. نیاز به یک `unfreeze()` امن (با تایید) وجود دارد.
- **نحوه رفع:** افزودن `unfreeze` با authentication:

```typescript
unfreeze(authToken?: string): void {
  if (!this._frozen) return;
  if (authToken && this._verifyAuthToken(authToken)) {
    this._frozen = false;
    // جایگزینی با مجوزهای جدید
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-PRM-01: افزودن permission caching با reactivity
- **دلیل:** جلوگیری از محاسبه مکرر مجوزها.
- **پیاده‌سازی:** استفاده از `computed` برای مجوزهای پرکاربرد.

### IMP-PRM-02: Policy-based access control (PBAC)
- **دلیل:** انعطاف بیشتر در تعریف قوانین پیچیده دسترسی.
- **پیاده‌سازی:**

```typescript
interface Policy {
  name: string;
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  conditions?: (context: any) => boolean;
}

class PolicyEngine {
  evaluate(policy: Policy, context: any): boolean {
    if (policy.conditions && !policy.conditions(context)) {
      return policy.effect === 'deny'; // Default deny
    }
    return policy.effect === 'allow';
  }
}
```

### IMP-PRM-03: ادغام با router برای route guards
- **دلیل:** محافظت از مسیرها در سطح روت.
- **پیاده‌سازی:**

```typescript
export function requirePermission(permission: string): NavigationGuard {
  return (to: string, from: string) => {
    if (!checkPermission(permission)) {
      return '/unauthorized';
    }
    return true;
  };
}

// استفاده:
// beforeEach(requirePermission('admin:access'));
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **auth** | PermissionManager معمولاً با Auth برای تعیین هویت کاربر ترکیب می‌شود. | ✅ درست |
| **runtime/walker** | `processPermission`/`processRole` در مراحل walker. | ✅ درست |
| **stateful** | `zen-auth-view` از permission system استفاده می‌کند. | ✅ درست |
| **router** | نیاز به ادغام برای route guards (route permission). | ⚠️ ادغام ناقص |

---

## ۶. نتیجه‌گیری کلی

پکیج `permission` با توجه به اهمیت امنیتی، طراحی خوبی دارد. SEC-A5 (fail-closed), SEC-A6 (any/all syntax), SEC-A7 (freeze) نشان‌دهنده توجه به امنیت است. با این حال، `Object.freeze` shallow بودن و عدم مدیریت nested objects آسیب‌پذیری بالقوه‌ای ایجاد می‌کند.

**امتیاز کلی: ۷/۱۰** (امنیت نسبتاً خوب، نیاز به deep freeze و PBAC)
