# @zenith/vite-plugin

> Phase 10 — Vite Plugin for HMR and DevTools

پلاگین Vite برای فریم‌ورک Zenith. دو قابلیت اصلی فراهم می‌کند:

1. **HMR برای HTML** — تغییرات فایل‌های HTML بدون رفرش کامل صفحه اعمال می‌شوند.
2. **Auto-inject DevTools** — در حالت Development، DevTools Hook به‌صورت خودکار تزریق می‌شود.

## نصب

```bash
npm install @zenith/vite-plugin --save-dev
```

## استفاده

در `vite.config.ts` پروژه‌ی خود:

```typescript
import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';

export default defineConfig({
  plugins: [
    zenithPlugin(),
  ],
});
```

## گزینه‌ها

```typescript
zenithPlugin({
  // مسیرهای که باید برای HMR رصد شوند (پیش‌فرض: همه‌ی فایل‌های HTML)
  watchPatterns: ['**/*.html'],

  // آیا DevTools به‌صورت خودکار تزریق شود؟ (پیش‌فرض: true)
  autoInjectDevtools: true,

  // آیا HMR برای HTML فعال باشد؟ (پیش‌فرض: true)
  enableHtmlHMR: true,
});
```

## HMR چگونه کار می‌کند؟

1. وقتی یک فایل HTML تغییر می‌کند، Vite `handleHotUpdate` را فراخوانی می‌کند.
2. پلاگین بررسی می‌کند که فایل `.html` است.
3. یک رویداد custom `zenith:html-update` به مرورگر ارسال می‌کند.
4. در مرورگر، یک listener (که توسط پلاگین تزریق شده) رویداد را دریافت می‌کند.
5. اگر `window.__ZENITH_RELOAD__` موجود باشد، فریم‌ورک آن را فراخوانی می‌کند.
6. در غیر این صورت، صفحه به‌صورت کامل reload می‌شود.

```typescript
// window.__ZENITH_RELOAD__ توسط Zen.start ثبت می‌شود:
Zen.start(document.getElementById('app'), state);
// حالا window.__ZENITH_RELOAD__ موجود است.
```

## DevTools Auto-Injection

در حالت Development، پلاگین به‌صورت خودکار یک `<script>` به HTML اضافه می‌کند
که `initDevTools()` را فراخوانی می‌کند. این یعنی:

- `window.__ZENITH__` در دسترس است.
- افزونه‌ی Chrome می‌تواند State و کامپوننت‌ها را بازرسی کند.
- Timeline تغییرات State ضبط می‌شود.

برای غیرفعال کردن:

```typescript
zenithPlugin({ autoInjectDevtools: false });
```

## Production

در Production build (`vite build`)، این پلاگین no-op است:

- HMR فقط در dev server فعال است.
- DevTools فقط در dev injection می‌شود.

هیچ overhead در production bundle وجود ندارد.
