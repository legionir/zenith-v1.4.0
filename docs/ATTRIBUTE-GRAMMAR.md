# گرامر attributeها و رویدادهای Zenith (ATTRIBUTE-GRAMMAR)

> **#173** — سند مبنا برای گرامر attributeهای `zen-*` و رویدادهای `CustomEvent`.
> ریشه در [`NEW-PACKAGES-SPEC.md` بند ۰.۳](reports/NEW-PACKAGES-SPEC.md) دارد و مکمل
> [قرارداد API](./API-CONVENTIONS.md) است (آن سند «فعل‌ها/نام نوع» را ثابت می‌کند،
> این سند «گرامر HTML + متادیتا» را).
>
> **لینک از CONTRIBUTING:** این سند از [docs/README.md](./README.md) فهرست شده است.
> لینک از `CONTRIBUTING.md` پس از نگارش آن در **#107** افزوده می‌شود (CONTRIBUTING
> در موج ۴ نوشته می‌شود). تا آن زمان ارجاع معادل در `docs/README.md` و
> [API-CONVENTIONS.md](./API-CONVENTIONS.md) §۵ است.

این سند **منبع واحد حقیقت** است: همان قواعد را `language-server`،
`eslint-plugin` (قوانین `zenith/template/valid-directive` و
`zenith/template/no-unknown-option` — **#159**) و `compiler` اعمال می‌کنند و از
متادیتای `DirectiveMeta` همان فایل‌های `zenith.meta.json` / `html.customData.json`
تولید می‌شود. گیت `scripts/attribute-grammar.mjs` سازگاری این سند با رجیستری
متادیتا (`docs/meta/zenith.meta.seed.json`) را در CI قفل می‌کند.

---

## ۰. خلاصهٔ قوانین (TL;DR)

| # | قاعده | مثال |
|---|---|---|
| ۱ | attribute اصلی `zen-<name>`؛ مقدارش expression Zenith است (بدون `eval`) | `<div zen-if="isLoggedIn">` |
| ۲ | گزینه‌ها `zen-<name>-<option>` به‌صورت kebab-case | `zen-persist-driver="local"` |
| ۳ | boolean: وجود attribute = `true`؛ `"false"` غیرفعال می‌کند | `zen-cloak` / `zen-tabs-lazy="false"` |
| ۴ | عدد/مدت: literal یا expression با پیشوند `:`؛ مدت `500ms\|30s\|5m\|1h\|never` | `zen-persist-ttl="30s"` |
| ۵ | نام state خروجی با `zen-state` (پیش‌فرض `data`) | `zen-resource="url" zen-state="feed"` |
| ۶ | پیکربندی ساخت‌یافته `zen-<name>-options='{JSON}'` با schema | `zen-chart-options='{"legend":true}'` |
| ۷ | رویداد `zen-action:<event>.<modifier>` | `zen-action:click.prevent="save"` |
| ۸ | رویداد کامپوننت: `CustomEvent` با نام `zen-<name>-<event>` و `bubbles:true` | `new CustomEvent('zen-dialog-close',{bubbles:true})` |
| ۹ | وضعیت بصری برای CSS: `data-state` / `data-placement` / `data-disabled` | `[data-state="open"] { … }` |
| ۱۰ | متغیر CSS: `--zen-<pkg>-<token>` | `--zen-ui-z-index` |
| ۱۱ | هر directive یک `DirectiveMeta` ثبت می‌کند (§۳) | `defineDirectiveMeta({ name: 'zen-if', … })` |

---

## ۱. قواعد با مثال و «اجرا»

### ۱.۱ attribute اصلی: `zen-<name>` با مقدار expression

نام باید `zen-` + kebab-case باشد (`^zen-[a-z][a-z0-9]*(-[a-z0-9]+)*$`). مقدار
همیشه یک **expression** Zenith است که موتور `@zenith/expressions` ارزیابی می‌کند —
هیچ‌گاه `eval` نمی‌شود.

```html
<div zen-if="user.isLoggedIn">…</div>
<span zen-text="user.name"></span>
```

**اجرا:** `valid-directive` (#159) + اعتبار kebab-case در
`defineDirectiveMeta` (ZEN-1001 — `packages/schema/src/manifest.ts:12`).

### ۱.۲ گزینه‌ها: `zen-<name>-<option>` (kebab-case)

هر گزینهٔ یک directive با پسوند `-<option>` روی همان نام اصلی نوشته می‌شود و
باید در `attributes` متادیتای آن directive ثبت باشد.

```html
<input zen-model="form.user" zen-persist="cart.user" zen-persist-driver="local" />
```

**اجرا:** `no-unknown-option` (#159)؛ گیت `scripts/attribute-grammar.mjs`
(هر `zen-<name>-<option>` در جدول §۴ باید عضو `attributes` همان directive باشد).

### ۱.۳ boolean: وجود = true، `"false"` = غیرفعال

منطق از `@zenith/shared` — `parseBooleanAttr(value, def)`: نبود attribute → `def`؛
وجود خالی (`zen-x=""`) یا `"true"` → `true`؛ `"false"` → `false`؛ سایر مقادیر → `def`.

```html
<!-- روشن: وجود attribute کافی است -->
<div zen-cloak>…</div>
<!-- خاموش: "false" صریحاً غیرفعال می‌کند -->
<div zen-static="false">…</div>
```

**اجرا:** `parseBooleanAttr` در `@zenith/shared` (تست‌شده).

### ۱.۴ عدد/مدت: literal یا expression با پیشوند `:`

`parseDuration` (از `@zenith/shared`) واحدهای `ms|s|m|h`، عددِ بدون واحد (=ms) و
کلیدواژهٔ `never` (بدون انقضا) را می‌پذیرد. برای مقدار واکنشی، پیشوند `:`
می‌گذاریم تا directive آن را به‌جای literal، expression بخواند.

```html
<div zen-persist-ttl="30s"></div>           <!-- literal -->
<div zen-persist-ttl="never"></div>         <!-- بدون انقضا -->
<div zen-persist-debounce=":cfg.delay"></div>  <!-- expression با : -->
```

**اجرا:** `parseDuration` (تست‌شده)؛ `no-unknown-option` روی نام گزینه.

### ۱.۵ state خروجی: `zen-state` (پیش‌فرض `data`)

directiveهایی که نتیجه‌شان را در state می‌نویسند، نام کلید را از `zen-state`
می‌گیرند؛ نبودش یعنی `data`.

```html
<div zen-resource="'/api/users'" zen-state="users">…</div>
```

**اجرا:** `packages/resource/src/directive.ts:39` (`getAttribute('zen-state') || 'data'`).

### ۱.۶ پیکربندی ساخت‌یافته: `zen-<name>-options='{JSON}'`

وقتی گزینه‌ها بیش از چند مقدار ساده‌اند، یک attribute JSON با همان پیشوند
نام‌گذاری و اعتبارسنجی `@zenith/schema` (کلید ناشناخته → خطا در dev) استفاده می‌شود.

```html
<canvas zen-chart-options='{"legend":true,"height":240}'></canvas>
```

**اجرا:** schema در `@zenith/schema` (اعمال روی directiveهای واقعی → **#52**).

### ۱.۷ رویداد: `zen-action:<event>.<modifier>`

فرم پارامتریک با `:` (نام رویداد) و `.` (modifierها). پایهٔ `zen-action` یک
action name از رجیستری `@zenith/actions` می‌گیرد. modifierهای داخلی در
`BUILTIN_MODIFIERS` (`packages/events/src/modifiers.ts`): رفتار (`prevent`, `stop`,
`immediate`, `self`, `once`)، گزینهٔ listener (`passive`, `capture`)، زمان‌بندی
(`debounce.NNN`, `throttle.NNN`)، کلیدها (`enter`, `escape`, `tab`, `space`, `backspace`, `del`,
`up`, `down`, `left`, `right`) و کلیدهای تغییردهنده (`shift`, `ctrl`, `alt`, `meta`).
مرجع کامل هر modifier با مثال و نکتهٔ passive/capture:
[`packages/events/README.md`](../packages/events/README.md#modifier-ها-مرجع-کامل--136).

```html
<button zen-action="save">                    <!-- پیش‌فرض: click -->
<button zen-action:click.prevent="save">      <!-- رویداد + modifier -->
<button zen-action:keydown.enter="submit">    <!-- کلید خاص -->
```

**اجرا:** `parseBinding` در `@zenith/events`.

### ۱.۸ رویداد کامپوننت: `CustomEvent` با `zen-<name>-<event>` و `bubbles:true`

کامپوننت‌های عنصری (`<zen-…>`) رویداد سفارشان را با نام `zen-<name>-<event>` و
`bubbles: true` (تا delegation در `@zenith/events` به آن‌ها برسد) منتشر می‌کنند.

```ts
el.dispatchEvent(
  new CustomEvent('zen-dialog-close', { detail: { id }, bubbles: true }),
);
```

**اجرا:** قرارداد نام + `bubbles` الزامی (§۴ موارد ناسازگار: date-picker).

### ۱.۹ وضعیت بصری برای CSS: `data-state` / `data-placement` / `data-disabled`

directive/ui به‌جای classهای سفارشی، وضعیت را در attributeهای `data-*`
استاندارد می‌نویسد تا CSS فقط با انتخابگر attribute کار کند.

```html
<button data-state="open" data-placement="bottom-start" disabled>…</button>
```

```css
.zenith-stateful-button[data-state="success"] { color: green; }
.zenith-stateful-button[data-state="error"] { color: red; }
```

**اجرا:** `packages/runtime/src/directives/stateful-button.ts:158`
(`setAttribute('data-state', next)`).

### ۱.۱۰ متغیر CSS: `--zen-<pkg>-<token>`

توکن‌های قابل‌تمای CSS با پیشوند `--zen-<package>-` نام‌گذاری می‌شوند تا
در پروژه بدون تصادم override شوند.

```css
:root { --zen-ui-z-index: 50; --zen-tooltip-delay: 200ms; }
```

**اجرا:** قرارداد نام (بازهٔ پکیج‌ها در SPEC §۰.۴)؛ بازبینی انسانی در stylelint.

### ۱.۱۱ هر directive یک `DirectiveMeta` (§۳)

---

## ۲. استثنای‌های پارامتریک (colon grammar)

دو form با `:` در **نام attribute** (نه در مقدار) مجازند و در جدول §۴ با علامت
`:param` مشخص‌اند. این‌ها «گزینهٔ kebab» نیستند؛ پارامتر پس از `:` می‌آید:

| form | معنا | نمونه در مخزن |
|---|---|---|
| `zen-bind:<attr>` | اتصال expression به یک attribute HTML دلخواه | `packages/runtime/src/walker.ts:904` |
| `zen-action:<event>[.<modifier>]` | رویداد/اسلکتور (بند ۱.۷) | `packages/events/src/delegation.ts` |

> قاعدهٔ کلی (§۱.۲) برای گزینه‌ها از **kebab با `-`** استفاده می‌کند؛ تنها
> پارامترهای باز (attribute نامحدود HTML، نام رویداد نامحدود) از `:` بهره می‌برند،
> چون پیش از `:` پایان‌یافته‌اند و نمی‌توان آن‌ها را در یک لیست ثابت `attributes`
> ثبت کرد. `valid-directive` (#159) این دو پیشوند را به‌عنوان «پارامتریک» می‌شناسد.

---

## ۳. `DirectiveMeta` و ارتباط با `zenith.meta.json`

### ۳.۱ شکل فعلی (registry #142) و شکل کامل (SPEC §۰.۳)

`@zenith/schema` در حال حاضر شکل **حداقلی#142** را ثبت/اعتبارسنجی می‌کند
(`packages/schema/src/types.ts:54`):

```ts
interface DirectiveMeta {
  name: string;          // 'zen-if'  (kebab-case، اعتبار ZEN-1001)
  description: string;   // فارسی، غیرخالی
  syntax?: string;       // نمونهٔ مختصر برای docs/ویرایشگر
  attributes?: string[]; // زیر-attributeها (zen-else، zen-persist-driver …)
  values?: string[];     // مقدارهای مجاز ساده (enum/توضیح)
  docs?: string;         // لینک مستندات
}
```

SPEC §۰.۳ یک **شکل کامل** هم تعریف می‌کند (`kind`، `package`، `since`،
`priority`، `structural`، `value{type,required,description}`،
`options[{attr,type,default,values,description}]`، `events`، `ssr`، `compilable`).
گسترش type به این فیلدها و پر کردنش از بدنهٔ directiveها در **#52/#148/#172**
صورت می‌گیرد؛ این سند (§۴) فعلاً همان اطلاعات را به‌صورت انسانی طبقه‌بندی و
«موارد ناسازگار» را فهرست می‌کند تا مبنای آن کارها ثابت شود.

### ۳.۲ یک نمونهٔ کاملِ `defineDirectiveMeta`

```ts
import { defineDirectiveMeta } from '@zenith/schema';

defineDirectiveMeta({
  name: 'zen-persist',
  description:
    'مقدار zen-model را زیر کلید داده‌شده در @zenith/storage ذخیره و هنگام mount بازیابی می‌کند؛ فقط روی المان دارای zen-model معنا دارد.',
  syntax: '<input zen-model="$form.user" zen-persist="cart.user" zen-persist-driver="local" />',
  attributes: ['zen-persist-driver', 'zen-persist-ttl', 'zen-persist-version', 'zen-persist-debounce'],
  values: ['کلید ذخیره (string غیرخالی)'],
  docs: 'https://zenith.dev/docs/storage#zen-persist',
});
```

### ۳.۳ مسیر تولید

```
defineDirectiveMeta(...)              ← ثبت در رجیستری (manifest.ts)
   │  (امروز: docs/meta/zenith.meta.seed.json — seed دست‌نویس هم‌شکل)
   ▼
toDirectiveManifest()  → zenith.meta.json     (ZenithMetaDoc v1، مرتب/یکتا)
toHtmlCustomData()     → html.customData.json (فرمت VS Code)
   ▲
scripts/gen-zenith-meta.mjs [--check]  ← گیت تازگی در CI (متناظر meta-snapshot.test.mjs)
```

`zenith.meta.json` خروجی **قطعی و مرتب‌شده بر اساس `name`** است؛ `html.customData.json`
هم‌نام از همان منبع، برای IntelliSense ویرایشگر. `eslint-plugin` (#159) و
`language-server` باید همین رجیستری را مصرف کنند تا «قانون lint = سند = متادیتا» بماند.

---

## ۴. طبقه‌بندی directiveهای موجود (≥۱۰) بر اساس این سند

جدول زیر directiveهای موجود در مخزن را با قواعد §۱/§۲ می‌سنجد. ستون
«گزینه‌ها/همراه» همان `attributes` ثبت‌شده در `zenith.meta.seed.json` است و گیت
`scripts/attribute-grammar.mjs` تطابقش را بررسی می‌کند. `:param` یعنی form
پارامتریک §۲.

| directive | kind | package | نوع مقدار | گزینه‌ها/همراه (از سند) | سازگار؟ |
|---|---|---|---|---|---|
| `zen-if` | attribute | runtime | expression (boolean) | `zen-else`, `zen-else-if` | ✅ |
| `zen-for` | attribute | runtime | expression (`item in items`) | `zen-key` | ✅ |
| `zen-text` | attribute | runtime | expression | — | ✅ |
| `zen-html` | attribute | runtime | expression (sanitize) | — | ✅ |
| `zen-html-trusted` | attribute | runtime | expression (raw) | — | ✅ |
| `zen-show` | attribute | runtime | expression (boolean) | — | ✅ |
| `zen-model` | attribute | runtime | expression path | — | ✅ |
| `zen-persist` | attribute | storage | string (کلید) | `zen-persist-driver`, `zen-persist-ttl`, `zen-persist-version`, `zen-persist-debounce` | ✅ |
| `zen-fetch` | attribute | data | expression (URL) | `zen-fetch-method`, `zen-fetch-body`, `zen-fetch-params`, `zen-fetch-cache` | ✅ |
| `zen-resource` | attribute | resource | expression (URL) | `zen-state` | ✅ |
| `zen-cloak` | attribute | runtime | none/boolean | — | ✅ |
| `zen-static` | attribute | runtime | boolean | — | ✅ |
| `zen-key` | attribute | runtime | expression | — | ✅ |
| `zen-ref` | attribute | runtime | expression (نام signal) | — | ✅ |
| `zen-transition` | attribute | transition | string (نام preset) | — | ✅ |
| `zen-action` | attribute | events | action name | `:param` (`zen-action:<event>.<modifier>`) | ⚠️ |
| `zen-bind` | attribute | runtime | expression | `:param` (`zen-bind:<attr>`) | ⚠️ |
| `zen-t` | attribute | i18n | string (کلید پیام) | `zen-t-params`, `zen-t-count`, `zen-t-default` | ✅ |
| `zen-t-html` | attribute | i18n | string (کلید پیام؛ sanitize پیش‌فرض escape) | `zen-t-params`, `zen-t-count`, `zen-t-default` | ✅ |
| `zen-t-attr` | attribute | i18n | نگاشت `"attr:key; attr2:key2"` | `zen-t-params` | ✅ |
| `zen-locale` | attribute | i18n | none (marker ⇒ `lang`) | — | ✅ |
| `zen-dir` | attribute | i18n | مقدارثابت `ltr\|rtl\|auto` | — | ✅ |

#### ۴.۰.۱ پوشش کامل سطح attribute (#120)

گیت `scripts/attribute-grammar.mjs` (#120) هر نام موجود در
`ZenithAttributes` (`packages/runtime/src/attributes.ts`) و هر دایرکتیو ثبت‌شده با
`defineDirective({ name })` را با این جدول تطبیق می‌دهد؛ ردیفِ نبودن یا
ثبت‌نشدن در seed متادیتا، گیت را قرمز می‌کند. جدول زیر ادامهٔ همان طبقه‌بندی است:

| directive | kind | package | نوع مقدار | گزینه‌ها/همراه (از سند) | سازگار؟ |
|---|---|---|---|---|---|
| `zen-head` | custom element / attribute | head | authored title/meta/link/base/JSON-LD | `zen-head-key` | ✅ |
| `zen-head-title` | attribute | head | expression text | `zen-head-key` | ✅ |
| `zen-head-description` | attribute | head | expression text | `zen-head-key` | ✅ |
| `zen-head-canonical` | attribute | head | expression text | `zen-head-key` | ✅ |
| `zen-head-og-image` | attribute | head | expression text | `zen-head-key` | ✅ |
| `zen-focus-trap` | attribute | a11y | expression boolean | `zen-focus-trap-initial`, `zen-focus-trap-return`, `zen-focus-trap-escape` | ✅ |
| `zen-autofocus` | attribute | a11y | expression boolean | — | ✅ |
| `zen-inert` | attribute | a11y | expression boolean | — | ✅ |
| `zen-scroll-lock` | attribute | a11y | expression boolean | — | ✅ |
| `zen-roving` | attribute | a11y | enum literal | `zen-roving-loop`, `zen-roving-selector` | ✅ |
| `zen-live` | attribute | a11y | enum literal | — | ✅ |
| `zen-announce` | attribute | a11y | expression text | `zen-announce-politeness`, `zen-announce-clear` | ✅ |
| `zen-reduced-motion` | attribute | a11y | enum literal | — | ✅ |
| `zen-animate` | attribute | transition | preset یا keyframes JSON | — | ✅ |
| `zen-dialog` | attribute | ui | expression | `zen-dialog-modal`, `zen-dialog-role`, `zen-dialog-close-on-esc`, `zen-dialog-close-on-backdrop`, `zen-dialog-initial-focus`, `zen-dialog-return-focus`, `zen-dialog-scroll-lock`, `zen-dialog-portal`, `zen-dialog-transition`, `zen-dialog-transition-duration` | ✅ |
| `zen-popover` | attribute | ui | expression | `zen-popover-trigger`, `zen-popover-placement`, `zen-popover-offset`, `zen-popover-flip`, `zen-popover-shift`, `zen-popover-arrow`, `zen-popover-trigger-on`, `zen-popover-return-focus`, `zen-popover-role`, `zen-popover-transition`, `zen-popover-transition-duration` | ✅ |
| `zen-tooltip` | attribute | ui | expression | `zen-tooltip-trigger`, `zen-tooltip-placement`, `zen-tooltip-offset`, `zen-tooltip-flip`, `zen-tooltip-shift`, `zen-tooltip-arrow`, `zen-tooltip-delay`, `zen-tooltip-hide-delay`, `zen-tooltip-disabled`, `zen-tooltip-transition`, `zen-tooltip-transition-duration` | ✅ |
| `zen-tabs` | attribute | ui | expression | `zen-tabs-orientation`, `zen-tabs-activation`, `zen-tabs-lazy`, `zen-tabs-transition`, `zen-tabs-transition-duration` | ✅ |
| `zen-accordion` | attribute | ui | expression | `zen-accordion-multiple`, `zen-accordion-collapsible`, `zen-accordion-transition`, `zen-accordion-transition-duration` | ✅ |
| `zen-menu` | attribute | ui | expression | `zen-menu-trigger`, `zen-menu-placement`, `zen-menu-offset`, `zen-menu-flip`, `zen-menu-shift`, `zen-menu-arrow`, `zen-menu-trigger-on`, `zen-menu-return-focus`, `zen-menu-loop`, `zen-menu-typeahead`, `zen-menu-close-on-select`, `zen-menu-transition`, `zen-menu-transition-duration` | ✅ |
| `zen-combobox` | attribute | ui | expression | `zen-combobox-options`, `zen-combobox-option-label`, `zen-combobox-option-value`, `zen-combobox-filter`, `zen-combobox-allow-custom`, `zen-combobox-async`, `zen-combobox-debounce`, `zen-combobox-min-chars`, `zen-combobox-multiple`, `zen-combobox-transition`, `zen-combobox-transition-duration` | ✅ |
| `zen-date-picker` | custom element / attribute | ui (runtime bridge) | date / range | `calendar`, `locale`, `value`, `min`, `max`, `first-day`, `format`, `disabled`, `readonly`, `required`, `name`, `form`, `range`, `disabled-dates`, `nonce` | ✅ |
| `zen-portal` | attribute | runtime | CSS selector | — | ✅ |
| `zen-intersection` | attribute | runtime | expression (callback) | — | ✅ |
| `zen-component` | attribute | components | نام کامپوننت تعریف‌شده | `zen-props` | ✅ |
| `zen-props` | attribute | components | JSON نگاشت propها | — | ✅ |
| `zen-html-slot` | attribute | components | نام slot | — | ✅ |
| `zen-form` | attribute | form | نام/expression schema | `zen-field`, `zen-submit` | ✅ |
| `zen-field` | attribute | form | نام field | `zen-validate` | ✅ |
| `zen-submit` | attribute | form | نام action | — | ✅ |
| `zen-validate` | attribute | form | `required,email,…` (CSV قاعده) | — | ✅ |
| `zen-route` | attribute | router | مسیر | — | ✅ |
| `zen-outlet` | attribute | router | empty | — | ✅ |
| `zen-link` | attribute | router | مسیر (SPA navigation) | — | ✅ |
| `zen-store` | attribute | store | نام store | — | ✅ |
| `zen-auth` | attribute | auth | نام نمونهٔ auth | — | ✅ |
| `zen-stop-propagation` | attribute | events | `true` | — | ✅ |
| `zen-prevent-default` | attribute | events | `true` | — | ✅ |
| `zen-item-height` | attribute | virtual-list | عدد (px) | — | ✅ |
| `zen-buffer` | attribute | virtual-list | عدد | — | ✅ |
| `zen-dynamic-heights` | attribute | virtual-list | `true` | — | ✅ |
| `zen-else` | attribute | runtime-core | none (companion) | — | ✅ |
| `zen-else-if` | attribute | runtime-core | expression (boolean) | — | ✅ |
| `zen-memo` | attribute | runtime-core | expression | — | ✅ |
| `zen-resource-view` | component | stateful | tag سفارشی (`<zen-resource-view>`) | `config`, `empty-text`, `retry-text` | ✅ |
| `zen-action-button` | component | stateful | tag سفارشی (`<zen-action-button>`) | `action`, `loading-text` | ✅ |
| `zen-auth-view` | component | stateful | tag سفارشی (`<zen-auth-view>`) | `config` | ✅ |

### ۴.۱ موارد ناسازگار (بایستی اصلاح شوند؛ هر کدام issue خودش را دارد)

- **`zen-action` — form دوگانه:** هم `zen-action="save"` و هم
  `zen-action:submit.prevent="authLogin"` (مثال‌های `packages/auth/src/auth.ts:39`
  و `packages/crud/src/crud.ts:25`) در مخزن رایج‌اند؛ با §۱.۷ سازگار است اما
  ⚠️ چون نامش با `:` پارامتر می‌گیرد، در جدول §۴ «پارامتریک» (§۲) علامت خورده
  تا `valid-directive` آن را با الگوی گزینهٔ kebab (§۱.۲) ارزیابی نکند.
- **`zen-bind:data-*`:** `packages/crud/src/crud.ts` با `zen-bind:data-resource`
  مقصود «attribute داده» را دارد؛ §۱.۶ می‌گوید پیکربندی ساخت‌یافته باید
  `zen-<name>-options='{JSON}'` باشد. ⚠️ → **#52** (اعمال schema) و **#172**.
- **`data-body`/`data-ids` (crud):** بدنه/آی‌دی به‌جای `zen-crud-options='{…}'`
  از `data-*` خام خوانده می‌شود (`packages/crud/src/crud.ts:203,308`) — با
  §۱.۶ ناسازگار. ⚠️ → **#52**.
- **رویداد date-picker:** مسیر قدیمی runtime اکنون bridge پکیج UI است.
  `zen-date-picker-change` با `bubbles/composed` و detail کامل نوشته شده؛
  `change` برای انتخاب کامل به‌عنوان سازگاری حفظ شده است. صحت این candidate هنوز
  در اجرای نهایی unit/browser بررسی می‌شود، نه با تغییر نام به‌تنهایی.
- **attributeهای هم‌خانواده بدون ثبت:** `zen-crud-*`، `zen-router-*`،
  `zen-suspense-*`، `zen-virtual-list-*`، `zen-animate-*`، `zen-enter-*`/`zen-leave-*`
  (classهای transition) هنوز `DirectiveMeta` ندارند — ثبتشان در **#52/#148**.

---

## ۵. نگاشت قاعده ↔ lint / گیت

| قاعدهٔ سند | کلید lint (#159) | گیت فعلی |
|---|---|---|
| §۱.۱ نام/_expression_ | `zenith/template/valid-directive` | `defineDirectiveMeta` (ZEN-1001) |
| §۱.۲ گزینهٔ ناشناخته | `zenith/template/no-unknown-option` | `scripts/attribute-grammar.mjs` (سازگاری جدول↔seed) |
| §۲ form پارامتریک | `zenith/template/valid-directive` (پیشوند `zen-bind:`/`zen-action:`) | — |
| §۳ متادیتای الزامی | `zenith/template/no-unknown-directive` | رجیستری + `meta-snapshot.test.mjs` |
| §۴ تازگی خروجی | — | `gen-zenith-meta.mjs --check` |

> قوانین `eslint-plugin` در **#159** (موج ۴) پیاده می‌شوند؛ تا آنجا گیت
> `attribute-grammar.mjs` حداقلِ ماشین‌پذیرِ سازگاری سند↔رجیستری را در CI نگه
> می‌دارد.


### Candidate owned accessibility/head bindings (unvalidated)

Boolean a11y attributes use an expression; an empty value opts in as `true`.
Their auxiliary boolean attributes and `zen-announce-clear` use strict shared
schema coercion (for example `5s`); malformed values do not acquire a browser
lease. `zen-live` owns role/status/alert, politeness and atomic attributes together.
All eight a11y bindings are client-only in explicit SSR documents.

`<zen-head>` (also `zen-head` on a container) has literal authored content, not an
expression value. Only title/meta/link/base and inline JSON-LD are accepted;
`zen-head-key` maps to the canonical entry key. Child bindings are suppressed via
Core's proposed `skipChildren` capability, and exact authored children return on
cleanup. Four expression directives use the same per-install head manager.
Source metadata and this grammar are updated; generated snapshots remain pending
until final validation. These notes are not acceptance/API-approval evidence.
