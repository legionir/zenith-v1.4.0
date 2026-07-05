# @zenith/scheduler

> Phase 7 — Microtask-based Effect Scheduler

پکیج `@zenith/scheduler` موتور بهینه‌سازی فریم‌ورک Zenith است. این پکیج با
استفاده از `queueMicrotask` (یا `Promise.resolve().then()`) تمام تغییرات
State را در یک تیک جمع‌آوری کرده و DOM را فقط **یک بار** در پایان آپدیت می‌کند.

## مشکل

بدون Scheduler، وقتی یک `Signal.set()` فراخوانی می‌شود، تمام Effectهای
وابسته بلافاصله (Synchronous) اجرا می‌شوند:

```typescript
// بدون Scheduler — DOM ۱۰ بار آپدیت می‌شود!
for (let i = 1; i <= 10; i++) {
  count.set(i);  // ← هر بار Effectها اجرا می‌شوند و DOM آپدیت می‌شود
}
```

## راه‌حل

Scheduler Effectها را در یک صف (Queue) قرار می‌دهد و یک Microtask برای
اجرا در پایان تیک فعلی ثبت می‌کند:

```typescript
// با Scheduler — DOM فقط ۱ بار آپدیت می‌شود!
for (let i = 1; i <= 10; i++) {
  count.set(i);  // ← Effectها به صف اضافه می‌شوند، نه اجرا
}
// ← در microtask بعدی، Effectها یک‌بار اجرا می‌شوند (با مقدار نهایی ۱۰)
```

## API

```typescript
import {
  scheduleEffect,
  flushSync,
  hasPendingEffects,
  pendingEffectCount,
  clearScheduler,
} from '@zenith/scheduler';
```

### `scheduleEffect(effectFn: Function)`

یک Effect را در صف قرار می‌دهد. اگر اولین Effect در صف باشد، یک Microtask
برای flush ثبت می‌کند.

```typescript
scheduleEffect(() => {
  console.log('This runs in the next microtask');
});
```

### `flushSync()`

اجرای اجباری و Synchronous صف. تمام Effectهای معلق را بلافاصله اجرا می‌کند.

```typescript
count.set(1);
count.set(2);
count.set(3);
flushSync();  // ← Effectها همین‌جا اجرا می‌شوند (نه در microtask بعدی)
```

کاربردها:
- **Event Handlers:** برای اطمینان از آپدیت DOM قبل از اتمام رویداد.
- **تست‌ها:** برای sync کردن DOM بعد از `state.set()`.
- **SSR:** برای اطمینان از رندر کامل قبل از serialize.

### `hasPendingEffects(): boolean`

بررسی اینکه آیا Effectهای در انتظار وجود دارد.

```typescript
count.set(1);
console.log(hasPendingEffects());  // true
flushSync();
console.log(hasPendingEffects());  // false
```

## Design Notes

### چرا Set نه Array؟

اگر Signal A و Signal B هر دو به Effect X وابسته باشند، و هر دو در یک تابع
set شوند، Effect X فقط **یک بار** (نه دو بار) در صف قرار می‌گیرد و اجرا
می‌شود. این رفتار با استفاده از Set به‌طور خودکار به دست می‌آید.

### Re-entrancy Safety

اگر در حین flush، Effect جدیدی schedule شود (مثلاً از طریق Computed chain)،
در همان flush اجرا می‌شود (نه در microtask بعدی). این رفتار با حلقه‌ی
`while (queue.size > 0)` در `flushQueue` تضمین می‌شود.

اگر `flushSync()` در حین flush فراخوانی شود، نادیده گرفته می‌شود (با چک
کردن `isFlushing`).

### Infinite Loop Protection

اگر یک Effect در حین اجرا، خودش را دوباره schedule کند، می‌تواند باعث
infinite loop شود. محدودیت `MAX_FLUSH_ITERATIONS = 1000` از این جلوگیری
می‌کند و یک warning در console چاپ می‌کند.

### جایگزینی `batch()`

این Scheduler جایگزین 手動 `batch()` می‌شود. Batching به‌صورت خودکار توسط
Microtask اتفاق می‌افتد. تابع `batch()` در `@zenith/state` برای backward
compatibility نگه‌داشته شده اما اکنون یک no-op است.

### چرا `Promise.resolve().then()` به‌جای `queueMicrotask`؟

هر دو کار می‌کنند، اما `Promise.resolve().then()` در محیط‌های قدیمی‌تر
(بدون polyfill) هم در دسترس است. در محیط‌های مدرن، هر دو به یک microtask
توسط engine نگاشت می‌شوند.
