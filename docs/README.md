# 📚 مستندات رسمی Zenith Framework v1.4.0

Zenith یک فریم‌ورک فرانت‌اند نوآورانه با رویکرد **HTML-First** و معماری مبتنی بر **Signal** بدون Virtual DOM است.

## 📖 فهرست مستندات API

### هسته اصلی
- [Reactivity API (signal, effect, computed, createRoot)](./api/state.md)
- [مدیریت خطای یکپارچه](./api/error-management.md)
- [Scheduler و زمان‌بندی](./api/scheduler.md)

### زمان اجرا و رندر
- [Runtime API (Zen.start, Zen.stop)](./api/runtime.md)
- [SSR و Hydration](./api/ssr.md)
- [DevTools داخلی](./api/devtools.md)

### ماژول‌های کاربردی
- [فرم (createForm)](./api/form.md)
- [روتر](./api/router.md)

### ابزارهای توسعه
- [ابزارهای تست‌پذیری](./api/testing.md)

## 🚀 شروع سریع

```bash
# نصب پکیج‌های اصلی
npm install @zenith/state @zenith/runtime
```

```typescript
import { signal, effect, computed, createRoot } from '@zenith/state';
import { Zen } from '@zenith/runtime';

// ایجاد یک سیگنال واکنش‌گرا
const count = signal(0);

// ایجاد یک مقدار مشتق‌شده
const double = computed(() => count.get() * 2);

// اجرای کد در هر تغییر
effect(() => {
  console.log(`Count: ${count.get()}, Double: ${double.get()}`);
});

// راه‌اندازی اپلیکیشن
Zen.start('#app', { count, double });
```

## 🧠 مفاهیم کلیدی

### Signal
یک کانتینر واکنش‌گرا برای مقادیر است. وقتی مقدارش تغییر می‌کند، تمام وابسته‌ها به طور خودکار مطلع می‌شوند.

### Effect
تابعی است که هر بار سیگنال‌هایی که از داخلش دسترسی می‌گیرند تغییر کنند، دوباره اجرا می‌شود.

### Owner Tree
ساختار درختی برای مدیریت چرخه حیات افکت‌ها و محاسبات. وقتی یک Owner پاک می‌شود، تمام زیرمجموعه‌هایش هم پاک می‌شوند و از نشت حافظه جلوگیری می‌شود.

## 📋 وضعیت فعلی

- ✅ هسته Reactivity پایدار و تست‌شده
- ✅ سیستم Owner Tree و مدیریت چرخه حیات
- ✅ Build Pipeline استاندارد
- ✅ امنیت Expression Engine تضمین شده
- ✅ Scheduler بهینه شده
- ✅ SSR کامل با پشتیبانی از Streaming
- ✅ DevTools API استاندارد
- ✅ ابزارهای تست‌پذیری حرفه‌ای

## 🛠️ دستورهای توسعه / Development Commands

از ریشهٔ مخزن (پس از `npm ci`) این دستورها در دسترس‌اند:

| Command | Purpose |
| --- | --- |
| `npm run build` | Build all workspace packages (esbuild + `tsc` declarations) |
| `npm run typecheck` | Type-check every package (`scripts/typecheck-all.mjs`) |
| `npm test` | Run the vitest suite (`packages/*/test/**/*.test.ts`) |
| `npm run test:coverage` | Tests + v8 coverage with the ≥70% statements gate on core packages |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint 9 flat config (typed linting via `tsconfig.eslint.json`) |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` | Prettier write (HTML/Markdown excluded via `.prettierignore`) |
| `npm run format:check` | Prettier check (CI-enforced) |

CI (`.github/workflows/main.yml`) در هر پوش `lint`، `format:check`، `test:coverage` (with gate)، `typecheck` و `build` را اجرا می‌کند؛ جزئیات تصمیم در `docs/decisions/DEC-003-eslint-scope.md` و `DEC-002-vitest-runner.md`.

## 🤝 مشارکت
برای گزارش باگ یا درخواست ویژگی از Issue Tracker استفاده کنید.
