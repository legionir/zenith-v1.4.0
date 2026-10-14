# جدول انطباق دایرکتیوهای Runtime و Compiler (`#138`)

این سند وضعیت پشتیبانی هر دایرکتیو `zen-*` را میان مفسر زمان اجرا (`@zenith/runtime` / `@zenith/runtime-core`) و کامپایلر قالب (`@zenith/compiler`) مشخص می‌کند.

## ۱. دایرکتیوهای کامپایل‌پذیر (`COMPILABLE_DIRECTIVES`)

این دایرکتیوها مستقیماً توسط `compileTemplate()` به کد جاوااسکریپت واکنش‌گرا (`effect(...)`) تبدیل می‌شوند و در مجموعه تست‌های `runAllParityTests` برای برابری خروجی DOM با زمان اجرا بررسی می‌گردند:

| دایرکتیو | Runtime | Compiler | تست برابری (Parity) | توضیح |
|---|---|---|---|---|
| `zen-text` | ✅ | ✅ | ✅ | بایندینگ متنی امن (`textContent`) |
| `zen-html` | ✅ | ✅ | ✅ | بایندینگ HTML پاکسازی‌شده با `sanitizeHTML` |
| `zen-html-trusted` | ✅ | ✅ | ✅ | بایندینگ HTML مورد اعتماد با `sanitizeHTMLTrusted` |
| `zen-if` | ✅ | ✅ | ✅ | رندر شرطی ساختاری |
| `zen-show` | ✅ | ✅ | ✅ | نمایش/پنهان‌سازی با `style.display` |
| `zen-bind` | ✅ | ✅ | ✅ | بایندینگ صفت‌ها، کلاس‌ها و استایل‌ها (`zen-bind:*`) |
| `zen-model` | ✅ | ✅ | ✅ | بایندینگ دوطرفه روی عناصر فرم |
| `zen-for` | ✅ | ✅ | ✅ | حلقهٔ تکرار کلیددار |

---

## ۲. دایرکتیوهای فقط-Runtime (`RUNTIME_DIRECTIVES`)

این دایرکتیوها به زیرساخت زمان اجرا (مانند Event Delegation، Router، Resource، Observerهای مرورگر یا درخت کامپوننت) وابسته‌اند. کامپایلر صفت آن‌ها را روی عنصر حفظ می‌کند و در `CompiledTemplate.runtimeDirectives` گزارش می‌دهد تا `walker` زمان اجرا پس از `render()` آن‌ها را فعال سازد:

| دایرکتیو | Runtime | Compiler (Passthrough) | دسته |
|---|---|---|---|
| `zen-action` / `zen-action-button` / `zen-button` | ✅ | ✅ (Passthrough) | رویداد و اکشن |
| `zen-fetch` / `zen-resource` / `zen-resource-view` / `zen-optimistic` | ✅ | ✅ (Passthrough) | واکشی داده و منابع |
| `zen-router` / `zen-route` / `zen-outlet` / `zen-link` | ✅ | ✅ (Passthrough) | مسیریابی SPA |
| `zen-auth` / `zen-auth-view` / `zen-login` / `zen-logout` | ✅ | ✅ (Passthrough) | احراز هویت |
| `zen-permission` / `zen-role` | ✅ | ✅ (Passthrough) | مجوزها و RBAC |
| `zen-form` / `zen-field` / `zen-validate` / `zen-submit` | ✅ | ✅ (Passthrough) | فرم و اعتبارسنجی |
| `zen-component` / `zen-props` / `zen-html-slot` / `zen-island` | ✅ | ✅ (Passthrough) | کامپوننت و جزیره‌ها |
| `zen-if-chain` / `zen-else-if` / `zen-else` | ✅ | ✅ (Passthrough) | زنجیرهٔ شرطی |
| `zen-transition` / `zen-animate` | ✅ | ✅ (Passthrough) | انیمیشن و گذار |
| `zen-virtual-list` / `zen-virtual` / `zen-item-height` / `zen-buffer` / `zen-dynamic-heights` | ✅ | ✅ (Passthrough) | لیست مجازی |
| `zen-error` / `zen-suspense` | ✅ | ✅ (Passthrough) | مدیریت خطا و تعلیق |
| `zen-store` / `zen-ref` / `zen-cloak` / `zen-static` / `zen-memo` / `zen-key` | ✅ | ✅ (Passthrough) | ابزارهای هسته |
| `zen-portal` / `zen-intersection` / `zen-date-picker` / `zen-track` | ✅ | ✅ (Passthrough) | UI و تحلیل رفتاری |
