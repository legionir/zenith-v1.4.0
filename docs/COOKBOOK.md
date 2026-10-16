# کتاب آشپزی Zenith (Cookbook — ۱۰ الگوی کاربردی) (`#104`)

این مجموعه شامل **۱۰ دستورالعمل (Recipe) آمادهٔ اجرا** برای سناریوهای واقعی در پروژه‌های تجاری با فریم‌ورک Zenith است.

---

## ۱. اعتبارسنجی فرم واکنشی با `@zenith/form` و `@zenith/schema`

```ts test-run
import { createForm, defineRule } from '@zenith/form';
import { s } from '@zenith/schema';

// قواعد رشته‌ای (`'required|email'`) یا قاعدهٔ سفارشی با پیام فارسی
defineRule('phone', (value) => ({
  valid: /^09\d{9}$/.test(String(value)),
  error: 'شمارهٔ موبایل نامعتبر است',
}));

export const userSchema = s.object({
  email: s.string(),
  password: s.string(),
});

export const loginForm = createForm({
  initialValues: { email: '', password: '' },
  rules: {
    email: 'required|email',
    password: 'required|min:8',
  },
});

// دسترسی واکنشی به مقادیر و خطاها (بدون کپی)
export const emailError = () => loginForm.errors.get().email ?? null;
export const emailValue = () => loginForm.values.get().email;
```

---

## ۲. احراز هویت امن + محافظ مسیر (`@zenith/auth` + `@zenith/router`)

```ts test
import { auth, configureAuth } from '@zenith/auth';
import { beforeEach, navigate } from '@zenith/router';

configureAuth({
  endpoints: { login: '/api/auth/login', refresh: '/api/auth/refresh', me: '/api/auth/me' },
  loginPath: '/login', // مسیر ریدایرکتِ گارد
  autoRefresh: true,
});

beforeEach((to) => {
  if (to.startsWith('/dashboard') && !auth.isAuthenticated) {
    navigate('/login');
    return false;
  }
  return true;
});
```

---

## ۳. رندر سمت سرور (SSR) و جریان Web `ReadableStream` (`@zenith/ssr`)

```ts test
import { renderToString, renderToReadableStream } from '@zenith/ssr';

// رندر رشته‌ای با timeout و کش قالب (#91)
export async function handleSSRRequest(url: string) {
  return await renderToString(
    '<div id="app"><h1 zen-text="$title"></h1></div>',
    { title: 'فروشگاه زنیت' },
    { route: url, timeout: 5000, cacheTemplates: true },
  );
}

// رندر جریانی با پشتیبانی از backpressure و AbortSignal (#91)
export function handleStreamRequest(reqSignal: AbortSignal): ReadableStream<Uint8Array> {
  return renderToReadableStream(
    '<div id="app"><p zen-text="$welcome"></p></div>',
    { welcome: 'خوش آمدید' },
    { route: '/', signal: reqSignal, chunkSize: 1024 },
  );
}
```

---

## ۴. لیست مجازی ۱۰۰٬۰۰۰ ردیفه با پشتیبانی افقی و RTL (`@zenith/virtual-list`)

```ts test
import { createVirtualList } from '@zenith/virtual-list';

export function mountLargeList(container: HTMLElement) {
  const items = Array.from({ length: 100_000 }, (_, i) => ({
    id: i,
    title: `ردیف شماره ${i + 1}`,
  }));

  return createVirtualList({
    container,
    items,
    itemSize: 40,
    overscan: 5,
    renderItem: (item) => {
      const row = document.createElement('div');
      row.textContent = item.title;
      return row;
    },
  });
}
```

---

## ۵. جدول داده با مرتب‌سازی، فیلتر و صفحه‌بندی (`@zenith/data-table`)

```ts test
import { createDataTable } from '@zenith/data-table';

export const ordersTable = createDataTable({
  data: [
    { id: 101, customer: 'سارا احمدی', total: 450000 },
    { id: 102, customer: 'علی رضایی', total: 1200000 },
  ],
  columns: [
    { key: 'id', title: 'شناسه', sortable: true },
    { key: 'customer', title: 'مشتری', sortable: true, filterable: true },
    { key: 'total', title: 'مبلغ (تومان)', sortable: true },
  ],
  pagination: { enabled: true, pageSize: 10 }, // صفحه‌بندی با اندازهٔ صفحه
  sorting: { enabled: true }, // مرتب‌سازی سمت کلاینت روی ستون‌های sortable
});
```

---

## ۶. عملیات CRUD خوش‌بینانه و صف آفلاین (`@zenith/crud` + `@zenith/service-worker`)

```ts test
import { getResource, registerCrudActions } from '@zenith/crud';

// اکشن‌های crud-* را یک‌بار در رجیستری @zenith/actions ثبت می‌کند
registerCrudActions();

// رِسورس ثبت‌شدهٔ برنامه را می‌گیرد (دکمه‌ها با zen-action="crud-update" و… وصل می‌شوند)
export const products = getResource('products');
export function optimisticUpdate(id: number, patch: Record<string, unknown>) {
  // به‌روزرسانی خوش‌بینانه روی رِسورس ثبت‌شده (rollback در صورت شکست HTTP)
  return products?.updateOptimistic(id, patch);
}
```

---

## ۷. تقویم جلالی رسمی و فرمت‌بندی دوجهته (`@zenith/jalali` + `@zenith/i18n`)

```ts test
import { toJalaliParts, formatJalali, addMonths } from '@zenith/jalali';
import { formatCurrency, isolateBidi, applyDocumentDirection } from '@zenith/i18n';

applyDocumentDirection('fa-IR'); // تنظیم lang="fa-IR" و dir="rtl"
const nextMonth = addMonths(toJalaliParts(new Date()), 1); // ماه جلالی بعدی
export const invoiceDate = formatJalali(nextMonth, 'DD MMMM YYYY');
export const invoiceTotal = formatCurrency(1850000, 'fa-IR', 'IRT');
export const supportPhone = isolateBidi('+98 21 8877 6655', 'ltr');
```

---

## ۸. اعلان‌ها و دیالوگ‌های دسترس‌پذیر WCAG 2.2 AA (`@zenith/notifications`)

```ts test
import { toasts, confirm, renderAccessibleToast, notificationsAPI } from '@zenith/notifications';

export async function confirmDelete() {
  const accepted = await confirm({
    title: 'حذف رکورد',
    message: 'آیا از حذف این رکورد اطمینان دارید؟',
    confirmText: 'بله، حذف شود',
    cancelText: 'انصراف',
  });
  if (accepted) {
    toasts.success('رکورد با موفقیت حذف شد.');
    const latest = notificationsAPI.getNotifications().at(-1);
    if (latest) renderAccessibleToast(latest);
  }
}
```

---

## ۹. مدیریت متمرکز خطا با مرز خطا (`@zenith/error-boundary` + `@zenith/errors`)

```ts test
import { onError, showFallback } from '@zenith/error-boundary';

export const unsubscribeErrorLog = onError((err) => {
  // ارسال ساختاریافته به سامانهٔ مانیتورینگ (کد، دسته، source)
  void err.code;
});

// نمایش fallback دسترس‌پذیر روی یک المان (به‌جای رندر دستی HTML)
export function renderFallback(el: HTMLElement, message: string) {
  showFallback(el, `<div role="alert">خطایی رخ داد: ${message}</div>`);
}
```

---

## ۱۰. تست‌نویسی واحد و DOM برای کامپوننت‌ها (`@zenith/testing`)

```ts test-dom
import { createTestHarness } from '@zenith/testing';
import { render } from '@zenith/testing';

export function verifyCounterRender() {
  const test = createTestHarness(); // root ایزوله + dispose خودکار
  const count = test.signal(5);

  let rendered = 0;
  test.effect(() => {
    count.get();
    rendered++;
  });

  count.set(6);
  test.flush(); // flushSync زمان‌بند

  // render یک قالب HTML-First را در container ایزوله mount می‌کند
  const result = render('<span id="val" zen-text="$count"></span>', { count });
  const text = result.query('#val')?.textContent;

  result.unmount();
  test.dispose();
  return { text, rendered }; // { text: "6", rendered: 2 }
}
```
