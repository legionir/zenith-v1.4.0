# سازگاری مرورگرها و Node.js (`#32` — Browser & Node Compatibility)

این سند ماتریس رسمی پشتیبانی مرورگرها (`browserslist`) و نسخه‌های Node.js در فریم‌ورک Zenith را تعریف می‌کند.

---

## ۱. ماتریس Node.js در CI

فریم‌ورک Zenith از `engines.node: ">=18.19"` پشتیبانی می‌کند و در CI (`.github/workflows/main.yml`) روی سه نسخهٔ اصلی تست و بیلد می‌شود:

| نسخهٔ Node.js | وضعیت | دلیل |
|---|---|---|
| `18.19` | حداقل نسخهٔ پشتیبانی‌شده (Floor) | پشتیبانی از `process.getBuiltinModule` برای ایزولاسیون SSR |
| `20` | Maintenance LTS | سازگاری با محیط‌های سرور و کلود LTS |
| `22` | Active LTS | محیط پیش‌فرض CI و انتشار |

---

## ۲. مرورگرهای هدف (`browserslist`)

در `package.json` ریشه، تنظیمات زیر ثبت شده است:

```json
{
  "browserslist": [
    "Chrome >= 109",
    "Edge >= 109",
    "Firefox >= 115",
    "Safari >= 16.4",
    "iOS >= 16.4",
    "not dead"
  ]
}
```

### ویژگی‌های کلیدی وب در موتورهای هدف

- **`ResizeObserver` و `IntersectionObserver`**: پشتیبانی بومی در هر سه موتور؛ در محیط‌های بدون آن (مانند SSR یا مرورگرهای قدیمی‌تر)، `@zenith/virtual-list` و `@zenith/components` به fallback ایمن برمی‌گردند.
- **CSS Transitions / Animations (`@zenith/transition`)**: محاسبهٔ بیشترین مدت‌زمان (`transitionDuration` + `transitionDelay`) همراه با fallback timer برای Safari (WebKit) و Firefox که در تب‌های پس‌زمینه ممکن است `transitionend` را با تأخیر ارسال کنند.
- **Trusted Types (`@zenith/security`)**: در Chromium از `window.trustedTypes.createPolicy('zenith-html')` استفاده می‌شود و در Firefox/WebKit به رشته‌های sanitize‌شدهٔ استاندارد fallback می‌کند.

---

## ۳. تست خودکار سه موتور در Playwright

فایل `playwright.config.ts` سه پروژهٔ `chromium`، `firefox` و `webkit` را در CI تعریف و اجرا می‌کند:

```bash
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```
