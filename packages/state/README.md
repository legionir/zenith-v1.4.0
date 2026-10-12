# @zenith/state

موتور Reactivity فریم‌ورک Zenith — یک سیستم واکنش‌گرای دقیق، سریع و قابل‌اعتماد برای ساخت رابط‌های کاربری مدرن.

## ویژگی‌ها

- ✅ **Signal** — ظرف‌های واکنش‌گرا با Dependency Tracking خودکار
- ✅ **Effect** — توابع واکنش‌گرا با قابلیت Dispose
- ✅ **Computed** — مقادیر محاسباتی با Caching هوشمند
- ✅ **Batch** — بهینه‌سازی Performance با اجرای دسته‌ای
- ✅ **Environment-agnostic** — بدون وابستگی به DOM

## نصب

```bash
npm install @zenith/state
```

## استفاده

```typescript
import { signal, effect, computed, batch } from '@zenith/state';
```

برای مثال‌های کامل، به [README اصلی](../../README.md) مراجعه کنید.

## تست

```bash
npm test
```

## پروتکل cleanup (موج #116 / DEC-032)

- `effect`/`createOwner` یک `Cleanup` (`() => void`) برای آزادسازی برمی‌گردانند؛
  اجرای دوبارهٔ آن بی‌اثر است (idempotent).
- `onCleanup(fn)` و `registerCleanup(cleanup)` یک `Cleanup` برمی‌گردانند که فقط
  ثبت خودشان را حذف می‌کند (با محافظ هویت).
- `onEffectError(handler)` برگشت‌پذیر است: `Cleanup` آن هندلر را تنها در صورتی
  پاک می‌کند که همان هندلر ثبت‌شده باقی مانده باشد.

> `Cleanup` همان `() => void` است که در `@zenith/shared` تعریف شده؛ state به‌دلیل
> DEC-021 آن را inline نگه می‌دارد (نه import از shared).

## مجوز

MIT

