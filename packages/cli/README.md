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
- `src/main.ts` — تعریف State و Action ها
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

### Code-first scaffold candidate

`zenith create my-app --template spa|ssr|pwa|dashboard|minimal` and the preview
command now use the same manifest. `--pwa` remains an alias. All browser entries
are `src/main.ts`; generated dependency ranges come from workspace release
metadata, not `workspace:*`. These packages still need to be published/available
(or supplied as packed tarballs) before an external install can be certified.

SSR includes a Node server, Vite middleware/HMR in development and production
static serving. PWA includes its worker, manifest, starter SVG and build plugin;
custom worker registration has one owner. Git initialization can be skipped with
`--no-git`. Creating a project does not install dependencies or execute builds.

The five local manifests do not claim completion of the separate independent
`create-zenith`/`@zenith/templates` package issue. Clean install, generated-project
typecheck/build and browser acceptance remain deferred with the final gates.

## چرخهٔ توسعه و قرارداد خروجی (#109؛ candidate اجرا نشده)

```sh
zenith dev --cwd ./my-app
zenith build --cwd ./my-app --json
zenith test --cwd ./my-app --timeout 120000
zenith doctor --cwd ./my-app --json
zenith upgrade --cwd ./my-app --json        # فقط plan؛ هیچ فایلی تغییر نمی‌کند
zenith upgrade --cwd ./my-app --write       # اعمال با backup اختصاصی
```

- dev/build/test ابتدا script هم‌نام پروژه را با npm اجرا می‌کنند؛ در نبود script،
  از Vite/Vitest **نصب‌شدهٔ همان پروژه** استفاده می‌کنند. دانلود/install خودکار،
  fallback موفق یا shell interpolation روی آرگومان‌های کاربر وجود ندارد.
- `--config`، `--timeout` (میلی‌ثانیه، صفر یعنی بدون deadline)، `--host/--port`
  برای dev و آرگومان‌های اضافی بعد از `--` پشتیبانی می‌شوند. به script سفارشی
  flag پیش‌فرض Vite تزریق نمی‌شود. watch صریح است؛ script حاوی `vitest run`
  برای `--watch` باید توسط کاربر به script watch-capable تبدیل شود.
- scriptهای lifecycle می‌توانند کد دلخواه پروژه اجرا کنند؛ فقط پروژهٔ مورداعتماد
  را اجرا کنید. روی POSIX، SIGINT/SIGTERM به process group منتقل و در deadline
  force-kill می‌شود؛ Windows برای جلوگیری از orphan از taskkill /T /F استفاده می‌کند (توقف forceful) و
  نیازمند شاهد OS-specific در اعتبارسنجی نهایی است.
- کد خروج: **۰** موفق، **۱** ورودی نامعتبر/تشخیص خطا/شکست ابزار/وقفه، **۲**
  خطای زیرساخت، شکست spawn، deadline یا serialization. runner exit خام در data
  نگه داشته می‌شود. help/version صفر و اشتباه آرگومان یک است.
- `--json` قبل یا بعد از command، دقیقاً یک envelope با
  `{schemaVersion:1, command, ok, exitCode, data, messages, errors, truncated}`
  روی stdout می‌دهد؛ diagnostic و خروجی child در همین envelope ثبت می‌شوند.
  capture پیام‌ها سقف ۲۵۶Ki کاراکتر دارد؛ قطع‌شدن با `truncated` اعلام می‌شود.
  `--json` پس از delimiter `--` متعلق به child است، نه CLI.
- doctor گراف **فیزیکی** node_modules را با realpath دنبال می‌کند؛ دو نصب state
  حتی با نسخهٔ برابر خطاست. Node engines، rangeها، peerها، dependency غایب،
  config و lockfileهای متعارض گزارش می‌شوند. config پویا نیاز به بررسی دستی دارد؛
  این نسخه inspector مخصوص node_modules/pnpm است، نه تأییدکنندهٔ Yarn PnP.
- upgrade تبدیل AST/binding-aware برای const instanceهای کلاس‌های شناخته‌شدهٔ
  Zenith از destroy به dispose و import/namespace قدیمی notifications را دارد.
  comment/string، local shadowed، object نامرتبط و متغیر mutable تغییر نمی‌کنند.
  migrationهای پرخطر/دیگر majorها خودکار ادعا نمی‌شوند. rangeهای خاص، downgrade
  یا تغییر major به manual report می‌روند و exit۱ می‌دهند.
- `--write` backup با پسوند `.zenith.bak` را با ایجاد انحصاری می‌نویسد؛ backup
  قبلی overwrite نمی‌شود. در شکست جزئی rollback انجام می‌شود؛ ویرایش هم‌زمان
  overwrite نمی‌شود و در صورت نیاز backup برای بازیابی دستی حفظ می‌شود. lockfile
  و dependency نصب‌شده خودکار تغییر نمی‌کنند؛ پس از review جداگانه نصب کنید.
- همهٔ پنج scaffold اکنون script و فایل تست دارند. کف Node **ابزارهای پروژهٔ
  تولیدی** `^20.19.0 || >=22.12.0` است، مستقل از کف runtime کتابخانه‌ها و CLI.
- `@zenith/cli/program` ورودی بدون autorun برای ساختن program یا `runCli(argv)`
  است؛ bin از entry اجرایی مستقل استفاده می‌کند. ساخت بسته از builder مشترک
  انجام می‌شود تا ESM/CJS، subpath و declaration واقعاً هم‌مسیر باشند.

کد و تست‌های این بخش نوشته شده‌اند، اما تست، build، pack/install و شاهد مصرف‌کنندهٔ
نهایی هنوز اجرا نشده‌اند؛ این توضیحات گواه پذیرش نهایی کارت نیستند.
