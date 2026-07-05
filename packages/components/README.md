# @zenith/components

> Phase 6 — Component System (Light DOM)

پکیج `@zenith/components` سیستم کامپوننت‌نویسی فریم‌ورک Zenith را فراهم می‌کند.
کامپوننت‌ها با **Light DOM** (نه Shadow DOM) پیاده‌سازی می‌شوند تا:

1. **Event Delegation** روی `document` به‌درستی کار کند.
2. **استایل‌های global CSS** روی محتوای کامپوننت اعمال شوند.
3. ساده‌تر و سریع‌تر از Shadow DOM باشد.

## تعریف کامپوننت

در HTML، قبل از استفاده از کامپوننت، آن را با `<zen-component>` تعریف کنید:

```html
<zen-component name="app-product-card">
  <template>
    <div class="card">
      <h3 zen-text="$name"></h3>
      <slot></slot>
      <slot name="actions"></slot>
    </div>
  </template>
</zen-component>
```

سپس می‌توانید از تگ سفارشی استفاده کنید:

```html
<app-product-card prop:name="product.name" prop:id="product.id">
  <p>توضیحات محصول</p>
  <button slot="actions" zen-action="buy">خرید</button>
</app-product-card>
```

## Props

دو نوع attribute روی تگ کامپوننت داریم:

| شکل | نوع | مثال | در Context محلی |
|-----|-----|------|-----------------|
| `prop:<name>="<expr>"` | Expression (ارزیابی در parent) | `prop:id="product.id"` | `$id` = value |
| `<name>="literal"` | Literal string | `theme="dark"` | `$theme` = "dark" |

attribute های `zen-*` به‌عنوان دایرکتیو شناخته می‌شوند و به‌عنوان prop در نظر گرفته نمی‌شوند.

### ⚠️ نکته‌ی مهم درباره‌ی نام Props

HTML attribute names **case-insensitive** هستند و مرورگر آن‌ها را به lowercase
تبدیل می‌کند. مثلاً `prop:outerValue` در DOM به `prop:outervalue` تبدیل می‌شود.
ما نام prop را همانطور که هست (lowercase) در Context محلی قرار می‌دهیم، پس در
template هم باید از همان نام lowercase استفاده کنید:

```html
<!-- ❌ غلط: $outerValue با V بزرگ در دسترس نیست -->
<app-card prop:outerValue="...">
  <span zen-text="$outerValue"></span>
</app-card>

<!-- ✅ درست: lowercase در همه‌جا -->
<app-card prop:outervalue="...">
  <span zen-text="$outervalue"></span>
</app-card>
```

برای props چندکلمه‌ای، **از underscore استفاده کنید** (نه kebab-case):

```html
<!-- ✅ درست: underscore -->
<app-card prop:user_name="...">
  <span zen-text="$user_name"></span>
</app-card>

<!-- ❌ غلط: kebab-case با `-` در Expression Engine تفریق می‌شود -->
<app-card prop:user-name="...">
  <span zen-text="$user-name"></span>  <!-- parse می‌شود به $user - name -->
</app-card>
```

Props با پیشوند `prop:` **Reactive** هستند: اگر Expression به یک Signal وابسته
باشد، هر بار که Signal تغییر کند، مقدار prop هم به‌روزرسانی می‌شود (چون یک
getter در Context تعریف می‌شود که هر بار Expression را ارزیابی می‌کند).

## Slots

دو نوع slot در قالب کامپوننت داریم:

```html
<template>
  <div>
    <slot></slot>                      <!-- پیش‌فرض -->
    <slot name="actions"></slot>       <!-- نام‌گذاری شده -->
  </div>
</template>
```

فرزندان داخل تگ کامپوننت:
- با `slot="actions"` → به slot نام‌گذاری شده می‌روند.
- بدون `slot` attribute → به slot پیش‌فرض می‌روند.

**نکته‌ی مهم:** محتوای slot با **Context والد** (محل استفاده‌ی کامپوننت) ارزیابی می‌شوند،
نه با Context محلی کامپوننت. این یعنی `zen-text="product.price"` داخل slot به `$product`
از `zen-for` بیرونی اشاره دارد، نه به Props کامپوننت.

## Context ارث‌بری

Context محلی کامپوننت با `Object.create(parentContext)` ساخته می‌شود. این یعنی:

- تمام getter های والد (مثل `$user`, `$product` از `zen-for`) در دسترس هستند.
- Props جدید به‌صورت `$name` روی Context محلی قرار می‌گیرند و در صورت تداخل،
  مقدار والد را shadow می‌کنند (در prototype chain).
- هیچ کپی سطحی انجام نمی‌شود — getter های reactive حفظ می‌شوند.

## API

```typescript
import {
  loadComponents,
  processComponent,
  isComponent,
  registerComponent,
  unregisterComponent,
  getComponent,
  clearComponents,
} from '@zenith/components';

// لود خودکار از <zen-component> در DOM
loadComponents(document.getElementById('app'));

// بررسی تگ
if (isComponent('app-product-card')) { ... }

// ثبت دستی (برای تست‌ها)
const tpl = document.createElement('template');
tpl.innerHTML = '<div zen-text="$name"></div>';
registerComponent('my-comp', tpl);
```

## Design Notes

- **چرا Light DOM به‌جای Shadow DOM؟**
  - Shadow DOM نیاز به تنظیم مجدد Event Delegation دارد (events در shadow boundary متوقف می‌شوند).
  - استایل‌های global در Shadow DOM به‌طور پیش‌فرض اعمال نمی‌شوند (باید `::part()` یا CSS custom properties استفاده کرد).
  - Light DOM با فرض‌های ساده‌تر فریم‌ورک ما سازگارتر است.

- **چرا `Object.create(parentContext)` به‌جای spread؟**
  - spread (`{ ...parent }`) مقادیر فعلی را کپی می‌کند، نه getter ها را.
  - این یعنی اگر parent یک getter داشته باشد که `Signal.get()` می‌زند، در کپی
    مقدار فعلی آن ثابت می‌شود و دیگر reactive نیست.
  - `Object.create(parent)` یک prototype chain می‌سازد که getter های والد
    همچنان زنده‌اند و reactive می‌مانند.

- **چرا تفکیک Context برای slot content؟**
  - slot content در محیط مصرف‌کننده‌ی کامپوننت نوشته شده، پس به State آن
    محیط باید دسترسی داشته باشد.
  - اما محتوای قالب کامپوننت با Props نوشته شده، پس به Context محلی نیاز دارد.
  - این تفکیک از نشت Props به محتوای slot جلوگیری می‌کند.
