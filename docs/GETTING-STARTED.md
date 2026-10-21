# راهنمای شروع سریع و آموزش گام‌به‌گام Zenith (`#104`)

این راهنما شما را در **کمتر از ۵ دقیقه** به اولین برنامهٔ واکنشی Zenith می‌رساند و سپس در یک **آموزش گام‌به‌گام ۳۰ دقیقه‌ای** مفاهیم اصلی فریم‌ورک را با مثال‌های واقعی پوشش می‌دهد.

---

## بخش ۱: شروع سریع در ۵ دقیقه (Quick Start)

### ۱. ساخت پروژه با CLI

```bash
npx @zenith/cli create my-zenith-app
cd my-zenith-app
npm install
npm run dev
```

یا نصب مستقیم در پروژهٔ موجود:

```bash
npm install @zenith/zenith @zenith/state @zenith/runtime
```

### ۲. اولین برنامهٔ واکنشی (`index.html` + `main.ts`)

```html
<!-- index.html -->
<div id="app" dir="rtl">
  <h1 zen-text="$title"></h1>
  <p>تعداد کلیک: <strong zen-text="$count"></strong></p>
  <button zen-on:click="increment()">افزایش +۱</button>
</div>
```

```ts test
// main.ts
import { createApp } from '@zenith/runtime';
import { signal } from '@zenith/state';

const count = signal(0);

const app = createApp({
  state: {
    title: 'خوش آمدید به Zenith!',
    count,
    increment: () => count.set(count.get() + 1),
  },
});

// mount یک المان می‌گیرد (Cleanup برمی‌گرداند؛ جایگزینِ Zen.start(selector, state))
const unmount = app.mount(document.getElementById('app')!);
```

---

## بخش ۲: آموزش گام‌به‌گام ۳۰ دقیقه‌ای — ساخت برنامهٔ مدیریت وظایف (Todo + Jalali + Form)

### گام ۱: تعریف وضعیت واکنشی با `signal` و `computed`

در Zenith هیچ Virtual DOM وجود ندارد؛ تغییرات `signal` مستقیماً و فقط گره DOM وابسته را به‌روزرسانی می‌کنند:

```ts test-dom
import { signal, computed, effect } from '@zenith/state';
import { formatJalali, jalaliNow } from '@zenith/jalali';

export interface TodoItem {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
}

export const todos = signal<TodoItem[]>([
  { id: 1, title: 'مطالعه مستندات Zenith', done: true, createdAt: formatJalali(new Date()) },
]);

export const remainingCount = computed(
  () => todos.get().filter((item) => !item.done).length,
);

// ثبت خودکار در کنسول یا ذخیره‌گاه هنگام تغییر
export const stopLog = effect(() => {
  const left = remainingCount.get();
  document.title = `وظایف باقی‌مانده (${left})`;
});
```

### گام ۲: اتصال قالب HTML-First (`zen-for`, `zen-model`, `zen-if`)

```html
<main id="todo-app" dir="rtl">
  <header>
    <h2>مدیریت وظایف روزانه</h2>
    <span zen-text="$today"></span>
  </header>

  <form zen-on:submit.prevent="addTodo()">
    <input
      type="text"
      zen-model="$draft"
      placeholder="عنوان وظیفه جدید..."
      aria-label="عنوان وظیفه جدید"
    />
    <button type="submit">افزودن</button>
  </form>

  <p zen-if="$remainingCount === 0">🎉 تمام وظایف انجام شدند!</p>

  <ul>
    <li zen-for="item in $todos" zen-key="item.id">
      <label>
        <input type="checkbox" zen-bind:checked="item.done" />
        <span zen-text="item.title"></span>
        <small zen-text="item.createdAt"></small>
      </label>
    </li>
  </ul>
</main>
```

### گام ۳: اعتبارسنجی فرم و اعلان دسترس‌پذیر (`@zenith/form` + `@zenith/notifications`)

```ts test
import { createForm, defineRule } from '@zenith/form';
import { toasts } from '@zenith/notifications';
import { formatJalali } from '@zenith/jalali';
import { signal } from '@zenith/state';

// قاعدهٔ سفارشی با پیام فارسی، در کنار قواعد رشته‌ای داخلی
defineRule('titleMin', (value) => ({
  valid: String(value).trim().length >= 3,
  error: 'حداقل ۳ کاراکتر وارد کنید',
}));

interface TodoItem {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
}

export const todos = signal<TodoItem[]>([]);

const todoForm = createForm({
  initialValues: { title: '' },
  rules: { title: 'required|titleMin' },
});

export async function submitTodo() {
  if (!(await todoForm.validate())) {
    toasts.error('لطفاً خطاهای فرم را برطرف کنید.');
    return;
  }
  const { title } = todoForm.values.get();
  todos.set([
    ...todos.get(),
    { id: Date.now(), title, done: false, createdAt: formatJalali(new Date()) },
  ]);
  todoForm.reset();
  toasts.success('وظیفه با موفقیت ثبت شد.');
}
```

---

## گام‌های بعدی

- [کتاب آشپزی (۱۰ دستورالعمل کاربردی) — `docs/COOKBOOK.md`](./COOKBOOK.md)
- [مرجع کامل گزینه‌ها و پیش‌فرض‌ها — `docs/OPTIONS-REFERENCE.md`](./OPTIONS-REFERENCE.md)
- [راهنمای مهاجرت بین نسخه‌ها — `docs/migration-guide.md`](./migration-guide.md)
