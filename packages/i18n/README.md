# @zenith/i18n

موتور چندزبانگی واقعی Zenith — پیام‌ها و زیرمجموعهٔ ICU (`plural`/`select`/`number`/`@:link`)،
locale/dir واکنشی، تشخیص خودکار locale، lazy-load و expressionها/attributeهای `zen-t*`
در کنار ابزارهای فارسی/جلالی (ارقام، تاریخ، قیمت). بدون وابستگی اجباری به runtime.

> ⚠️ مهاجرت: تابع‌های جلالی به `@zenith/jalali` سپرده شده‌اند؛ aliasهای این پکیج با
> deprecation (ZEN-DEPR-006..015) تا نسخهٔ 2.0 کار می‌کنند.

## نصب

```bash
npm install @zenith/i18n
# peerهای اجباری فقط در صورت استفاده از موتور واکنشی:
npm install @zenith/state
```

## استفادهٔ سریع — موتور i18n (#150)

```typescript
import { createI18n } from '@zenith/i18n';

const i18n = createI18n({
  locale: 'fa',
  fallbackLocale: 'en',
  messages: {
    fa: {
      greeting: 'سلام {name}',
      items: '{count, plural, =0 {موردی نیست} one {# مورد} other {# مورد}}',
    },
    en: { greeting: 'Hello {name}', items: '{count, plural, one {# item} other {# items}}' },
  },
});

i18n.t('greeting', { name: 'علی' }); // 'سلام علی'
i18n.t('items', { count: 2 }); // '۲ مورد' (arabext برای fa)
await i18n.setLocale('en'); // signals: locale/dir تغییر می‌کنند، effectها re-run
i18n.t('items', { count: 2 }); // '2 items'
void i18n.dispose();
```

## قالب پیام (زیرمجموعهٔ ICU)

| فرم | مثال |
|---|---|
| جایگذاری | `سلام {name}` |
| plural | `{count, plural, =0 {موردی نیست} one {# مورد} other {# مورد}}` |
| select | `{g, select, male {آقا} female {خانم} other {میهمان}}` |
| number | `{p, number}` / `{p, number, currency}` |
| date | `{w, date}` / `{w, date, relativeDay}` |
| لینک | `shared: '@:common.save'` (چرخه تا ۱۰ لینک) |

## API

`createI18n(opts) → I18n & Disposable`:

| عضو | نوع | توضیح |
|---|---|---|
| `locale` | `I18nSignal<string>` | خواندنی/نوشتنی؛ `.get()` `.set()` `.subscribe(fn)` |
| `dir` | `I18nReadonlySignal<'rtl'\|'ltr'>` | از rtlLocales مشتق می‌شود |
| `availableLocales` | `I18nReadonlySignal<readonly string[]>` | فهرست فعال فعلی |
| `t(key, params?, o?)` | `string` | ترجمه + ICU؛ o: `{ locale?, default?, count? }` |
| `te(key, locale?)` | `boolean` | وجود کلید در fallback-chain |
| `tm(key)` | `string \| undefined` | قالب خام بدون render |
| `n(value, fmt?)` | `string` | Intl.NumberFormat + numberingSystem تقویمی |
| `d(value, fmt?)` | `string` | Intl.DateTimeFormat (+ calendar persian برای fa) |
| `rt(value, unit)` | `string` | Intl.RelativeTimeFormat |
| `list(items, o?)` | `string` | Intl.ListFormat |
| `setLocale(l)` | `Promise<void>` | lazy: loadMessages(l) برای locale ناشناخته |
| `addMessages(l, msgs, o?)` | `Cleanup` | deep-merge؛ cleanup حالت قبلی را برمی‌گرداند |
| `detectLocale(ctx?)` | `string \| undefined` | query/cookie/storage/navigator/path |
| `dispose()` | `void` | idempotent؛ تمام subscribers پاک |

## گزینه‌ها (I18nOptions)

| گزینه | پیش‌فرض | توضیح |
|---|---|---|
| `locale` | `'en'` | locale آغازین |
| `fallbackLocale` | `'en'` | رشته یا آرایه |
| `messages` | `{}` | locale → Messages |
| `loadMessages` | — | لودر تنبل برای setLocale |
| `detect` | `[]` | ترتیب query\|cookie\|storage\|navigator\|path |
| `detectKey` | `'lang'` | نام کلید در query/cookie |
| `persist` | `'zen.locale'` | کلید storage؛ `false` = خاموش |
| `missing` | `'key'` | `key`\|`empty`\|`throw` (ZEN-1311) |
| `warnOnMissing` | dev | logger.warn در dev |
| `numberFormats` / `dateFormats` | `{}` | قالب‌های نام‌دار Intl |
| `calendar` | استنتاج (`fa` ⇒ `persian`) | — |
| `numberingSystem` | استنتاج (`fa` ⇒ `arabext`) | latn\|arab\|arabext |
| `timeZone` | SSR: `'UTC'` | — |
| `escapeParams` | `true` | escape HTML در پارامترهای رشته‌ای |
| `syncDocument` | `true` | sync `lang`/`dir` روی `<html>` |
| `rtlLocales` | `['fa','ar','he','ur']` | — |
| `defaultCurrency` | region (`IR` ⇒ `IRR`) | برای `{p, number, currency}` |
| `sanitizeHtml` | — | سانتیزر دایرکتیو zen-t-html (مثلاً sanitizeHTML از @zenith/security) |

## پلاگین Zenith (`app.use(i18nPlugin(options))`)

1. `provide('zenith:i18n', i18n)` — با `app.inject` در دسترس است.
2. **SSR** (`__ZENITH_I18N__` #174): پیام‌ها seed می‌شوند و locale سرور بدون
   fetch اعمال می‌شود؛ سپس payload پاک می‌شود.
3. attributeها ثبت می‌شوند: `zen-t`، `zen-t-html` (sanitize؛ پیش‌فرض escape
   کامل)، `zen-t-attr="title:key; aria-label:key2"`، `zen-locale` (⇒ `lang`)،
   `zen-dir="ltr|rtl|auto"`.
4. expressionهای گلوبال به state تزریق می‌شوند (`app.addState`):
   `$t, $te, $n, $d, $rt, $list, $locale, $dir` —
   `<span zen-text="$t('greeting', {name: $user.name})"></span>`.

## SSR

خروجی `@zenith/ssr` (#174) به‌صورت خودکار این تگ را می‌سازد:

```html
<script>
  window.__ZENITH_I18N__ = { locale:'fa', dir:'rtl', messages:{ fa:{...} } };
</script>
```

کلاینت با `i18nPlugin` بدون fetch و بدون hydration mismatch بالا می‌آید
(مسیر‌ sync اجرا می‌شود چون پیام‌های locale در صفحه موجودند).

## خطاها

| کد | معنا |
|---|---|
| `ZEN-1311` | کلید ناموجود (missing: 'throw') |
| `ZEN-1312` | قالب ICU نامعتبر (tolerant؛ warn + رشتهٔ خالی) |
| `ZEN-1313` | locale ناشناخته و loadMessages تعریف نشده |
| `ZEN-1314` | loadMessages در setLocale شکست خورد |

## ابزارهای جلالی/فارسی (مدول legacy — ثابت)

`toPersianNums`, `toJalali`, `jalaliNow`, `jalaliFormatter`, `persianPrice` و…

> aliasهای این ماژول روی `@zenith/jalali` با deprecate هستند؛ زندگی‌چرخهٔ
> تقویمی خارج از بازهٔ پشتیبانی‌شده در issue #101 تعریف‌شده می‌شود.

## مستندات مرتبط

- [ARCHITECTURE.md §۲](../../ARCHITECTURE.md)
- [docs/api/i18n.md](../../docs/api/i18n.md) — سردر API کامل تولیدشده
- [docs/ATTRIBUTE-GRAMMAR.md §۴](../../docs/ATTRIBUTE-GRAMMAR.md) — رجیستری zen-t*
- [README ریشه](../../README.md)

## مجوز

MIT
