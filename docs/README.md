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

## 🤝 مشارکت
برای گزارش باگ یا درخواست ویژگی از Issue Tracker استفاده کنید.
