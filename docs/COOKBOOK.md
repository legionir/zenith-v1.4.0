# کتاب آشپزی Zenith (Cookbook — ۱۰ الگوی کاربردی) (`#104`)

این مجموعه شامل **۱۰ دستورالعمل (Recipe) آمادهٔ اجرا** برای سناریوهای واقعی در پروژه‌های تجاری با فریم‌ورک Zenith است.

---

## ۱. اعتبارسنجی فرم واکنشی با `@zenith/form` و `@zenith/schema`

```ts
import { createForm, required, email, minLength } from '@zenith/form';
import { s } from '@zenith/schema';

export const userSchema = s.object({
  email: s.string(),
  password: s.string(),
});

export const loginForm = createForm({
  initialValues: { email: '', password: '' },
  validators: {
    email: [required('ایمیل الزامی است'), email('فرمت ایمیل نامعتبر است')],
    password: [required('رمز عبور الزامی است'), minLength(8, 'حداقل ۸ کاراکتر')],
  },
});
```

---

## ۲. احراز هویت امن + محافظ مسیر (`@zenith/auth` + `@zenith/router`)

```ts
import { configureAuth, isAuthenticated } from '@zenith/auth';
import { beforeEach, navigate } from '@zenith/router';

configureAuth({
  storage: 'memory', // ایمن در برابر XSS (#62)
  refreshUrl: '/api/auth/refresh',
});

beforeEach((to) => {
  if (to.startsWith('/dashboard') && !isAuthenticated()) {
    navigate('/login');
    return false;
  }
  return true;
});
```

---

## ۳. رندر سمت سرور (SSR) و جریان Web `ReadableStream` (`@zenith/ssr`)

```ts
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

```ts
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

```ts
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
  pageSize: 10,
});
```

---

## ۶. عملیات CRUD خوش‌بینانه و صف آفلاین (`@zenith/crud` + `@zenith/service-worker`)

```ts
import { createCrud } from '@zenith/crud';

export const productsCrud = createCrud<{ id: number; name: string }>({
  baseUrl: '/api/products',
  optimistic: true,
});
```

---

## ۷. تقویم جلالی رسمی و فرمت‌بندی دوجهته (`@zenith/jalali` + `@zenith/i18n`)

```ts
import { toJalaliParts, formatJalali, addMonths } from '@zenith/jalali';
import { formatCurrency, isolateBidi, applyDocumentDirection } from '@zenith/i18n';

applyDocumentDirection('fa-IR'); // تنظیم lang="fa-IR" و dir="rtl"
const nextMonth = addMonths(new Date(), 1);
export const invoiceDate = formatJalali(nextMonth, 'DD MMMM YYYY');
export const invoiceTotal = formatCurrency(1850000, 'fa-IR', 'IRT');
export const supportPhone = isolateBidi('+98 21 8877 6655', 'ltr');
```

---

## ۸. اعلان‌ها و دیالوگ‌های دسترس‌پذیر WCAG 2.2 AA (`@zenith/notifications`)

```ts
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

```ts
import { createErrorBoundary } from '@zenith/error-boundary';
import { onError } from '@zenith/errors';

export const unsubscribeErrorLog = onError((err) => {
  // ارسال ساختاریافته به سامانهٔ مانیتورینگ
  void err.code;
});

export const boundary = createErrorBoundary({
  fallback: (error) => `<div role="alert">خطایی رخ داد: ${error.message}</div>`,
});
```

---

## ۱۰. تست‌نویسی واحد و DOM برای کامپوننت‌ها (`@zenith/testing`)

```ts
import { createTestRoot, flushReactive } from '@zenith/testing';
import { signal } from '@zenith/state';

export async function verifyCounterRender() {
  const count = signal(5);
  const ctx = createTestRoot('<span id="val" zen-text="$count"></span>', { count });
  await flushReactive();
  const text = ctx.container.querySelector('#val')?.textContent;
  ctx.dispose();
  return text; // "5"
}
```
