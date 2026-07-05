# گزارش حسابرسی پکیج `stateful`
**نسخه:** v1.3.0 | **بسته:** `@zenith/stateful`

---

## ۱. خلاصه پکیج

پکیج `stateful` یک پلاگین فریم‌ورک است که کامپوننت‌های سطح بالای مبتنی بر state را به فریم‌ورک Zenith اضافه می‌کند. این پکیج `zen-resource-view`, `zen-action-button`, `zen-auth-view` را از طریق `registerCustomDirective` ثبت می‌کند و تابع `installStatefulComponents` را برای نصب دستی فراهم می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/index.ts` | ~۱۵۰+ | `ZenithStatefulPlugin`, `installStatefulComponents` |

---

## ۳. باگ‌ها و مشکلات

### BUG-STF-01: `registerCustomDirective` با دایرکتیوهای موجود تداخل دارد
- **شدت:** متوسط
- **محل:** `src/index.ts`
- **شرح:** ZenitStatefulPlugin با `Zen.use()` نصب می‌شود و `registerCustomDirective` را فراخوانی می‌کند. اگر دایرکتیوی با نام تکراری ثبت شود، دایرکتیو قبلی را بازنویسی می‌کند بدون هشدار.
- **نحوه رفع:** بررسی تداخل قبل از ثبت:

```typescript
const statefulDirectives = [
  { name: 'zen-resource-view', handler: processResourceView },
  { name: 'zen-action-button', handler: processActionButton },
  { name: 'zen-auth-view', handler: processAuthView },
];

export const ZenithStatefulPlugin: ZenithPlugin = {
  name: 'zenith-stateful',
  install(app: Zen): void {
    for (const directive of statefulDirectives) {
      if (hasCustomDirective(directive.name)) {
        console.warn(`[Zenith] Directive "${directive.name}" already registered. Skipping.`);
        continue;
      }
      registerCustomDirective(directive.name, directive.handler);
    }
  },
};
```

### BUG-STF-02: `installStatefulComponents` امکانی برای cleanup ندارد
- **شدت:** کم
- **محل:** `src/index.ts`
- **شرح:** `installStatefulComponents` دایرکتیوها را ثبت می‌کند اما هیچ تابع `uninstall` یا cleanup برای HMR برنمی‌گرداند.
- **نحوه رفع:** بازگرداندن تابع cleanup:

```typescript
export function installStatefulComponents(): () => void {
  const installed: string[] = [];
  for (const directive of statefulDirectives) {
    registerCustomDirective(directive.name, directive.handler);
    installed.push(directive.name);
  }
  return () => {
    for (const name of installed) {
      unregisterCustomDirective(name);
    }
  };
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-STF-01: افزودن کامپوننت‌های بیشتر stateful
- پیشنهاد: `zen-paginator`, `zen-search-box`, `zen-data-table`.

### IMP-STF-02: قابلیت configurable template برای stateful components
- **دلیل:** توسعه‌دهندگان بتوانند ظاهر stateful components را شخصی‌سازی کنند.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime** | از `registerCustomDirective` و `ZenithPlugin` استفاده می‌کند. | ✅ درست |
| **auth** | `zen-auth-view` از Auth state استفاده می‌کند. | ✅ درست |
| **resource** | `zen-resource-view` از Resource state استفاده می‌کند. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `stateful` یک پلاگین ساده و کاربردی است. مهم‌ترین مشکل آن عدم وجود cleanup برای HMR و عدم بررسی تداخل دایرکتیوهاست.

**امتیاز کلی: ۶.۵/۱۰** (کاربردی اما نیاز به بهبود مدیریت lifecycle)
