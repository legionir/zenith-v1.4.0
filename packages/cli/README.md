# @zenith/cli

> Phase 10 — CLI for Zenith Framework

ابزار خط فرمان برای ساخت پروژه‌ها و تولید کامپوننت‌ها، صفحات، و action ها
در فریم‌ورک Zenith.

## نصب

```bash
npm install -g @zenith/cli
```

یا استفاده با npx (بدون نصب سراسری):

```bash
npx @zenith/cli create my-app
```

## دستورات

### `zenith create <project-name>`

ساخت یک پروژه‌ی جدید Zenith با تمام فایل‌های پایه.

```bash
zenith create my-zenith-app
cd my-zenith-app
npm install
npm run dev
```

فایل‌های ساخته‌شده:
- `index.html` — صفحه‌ی اصلی با دایرکتیوهای Zenith
- `main.ts` — تعریف State و Action ها
- `vite.config.ts` — پیکربندی Vite با پلاگین Zenith
- `package.json` — وابستگی‌ها
- `tsconfig.json` — پیکربندی TypeScript
- `README.md` — مستندات پروژه
- `.gitignore` — فایل‌های نادیده‌گرفته‌شده توسط git
- `src/components/` — پوشه برای کامپوننت‌ها
- `pages/` — پوشه برای صفحات SPA

### `zenith generate <type> <name>` (alias: `g`)

تولید فایل‌های جدید. `<type>` می‌تواند یکی از `component`, `page`, `action` باشد.

#### `zenith generate component <Name>`

```bash
zenith generate component UserCard
# یا مخفف:
zenith g component UserCard
```

ساخت فایل `src/components/user-card.html`:

```html
<zen-component name="user-card">
  <template>
    <div class="user-card">
      <h2>UserCard</h2>
      <slot></slot>
    </div>
  </template>
</zen-component>
```

نام باید PascalCase باشد (مثل `UserCard`, `ProductCard`).

#### `zenith generate page <Name>`

```bash
zenith g page About
```

ساخت فایل `pages/about.html`:

```html
<div class="page page-about">
  <h1>About</h1>
  <p>این صفحه‌ی About است.</p>
</div>
```

#### `zenith generate action <name>`

```bash
zenith g action saveUser
```

ساخت فایل `src/actions/save-user.ts`:

```typescript
import { Zen } from 'zenith/runtime';

Zen.action('saveUser', ({ state, element, event }) => {
  console.log('Action "saveUser" called:', { state, element, event });
  // TODO: منطق اکشن را اینجا بنویسید.
});
```

نام باید camelCase باشد (مثل `saveUser`, `addToCart`).

### `zenith info`

نمایش اطلاعات فریم‌ورک و دستورات موجود.

## گزینه‌ها

### `--dir <path>` (یا `-d`)

مسیر خروجی را سفارشی کنید:

```bash
zenith g component UserCard --dir src/custom/
```

### `--no-git` (فقط برای `create`)

از initialization گیت صرف‌نظر کنید:

```bash
zenith create my-app --no-git
```

## مثال کامل

```bash
# ۱. ساخت پروژه
zenith create my-shop
cd my-shop
npm install

# ۲. ساخت کامپوننت‌ها
zenith g component ProductCard
zenith g component ShoppingCart

# ۳. ساخت صفحات
zenith g page Home
zenith g page Products
zenith g page Checkout

# ۴. ساخت action ها
zenith g action addToCart
zenith g action removeFromCart
zenith g action checkout

# ۵. اجرا
npm run dev
```

## Design Notes

### چرا PascalCase برای component و page؟

برای هماهنگی با عرف فریم‌ورک‌های مدرن (Vue, React, Solid). تبدیل به
kebab-case در فایل‌ها به‌صورت خودکار انجام می‌شود (`UserCard` → `user-card.html`).

### چرا camelCase برای action؟

چون action ها در HTML با نام camelCase استفاده می‌شوند:

```html
<button zen-action="addToCart">افزودن به سبد</button>
```

### فایل‌های ساخته‌شده قابل ویرایش

تمام قالب‌ها به‌عنوان نقطه‌ی شروع هستند. بعد از ساخت، می‌توانید آن‌ها را
به دلخواه ویرایش کنید.
