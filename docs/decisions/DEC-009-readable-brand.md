# DEC-009 — Brand «readable» با Symbol.for برای Signal/Computed

- **تاریخ**: 2026-10-09
- **وضعیت**: پذیرفته‌شده
- **issue**: #187 (Wave 1، کشف‌شده حین آزمون دستی README #69)

## زمینه

`createContext` در runtime و `createContextForEval` در events با duck-typing
`typeof v.get === 'function' && typeof v.set === 'function'` سیگنال‌ها را
تشخیص می‌دادند. کلاس `Computed` متد `set` ندارد (قرارداد readonly)، بنابراین
`computed()` در state کاربر به‌عنوان «مقدار ساده» یک‌بار در context کپی
می‌شد: template با `zen-text="$double"` هیچ‌وقت update نمی‌شد (اسنپ‌شات فریز).

## گزینه‌ها

1. **شل کردن check به `get`-only** — هر آبجکتی که `get()` دارد unwrap می‌شد؛
   serviceهای دارای `get()` (مثل `auth.signal.get` الگوها، Map-like ها)
   اشتباهاً unwrap می‌شدند. رد شد.
2. **`instanceof Signal`** — بین چند بیلد از `@zenith/state` (monorepo،
   افزونه‌ها، bundle کاربر + bundle runtime) شکننده است و کامنت خودِ کد
   (context.ts) قبلاً به همین دلیل آن را رد کرده بود. رد شد.
3. **Brand با `Symbol.for('zenith.readable')` روی prototype** — global symbol
   بین بیلدهای مختلف یکسان است؛ روی `Signal.prototype` و `Computed.prototype`
   ست می‌شود و از طریق زنجیرهٔ prototype ارث می‌برد. پذیرفته شد.

## تصمیم

`packages/state/src/readable.ts`:

- `ZENITH_READABLE = Symbol.for('zenith.readable')`
- `isReadable(v)`: برنددار **یا** duck-type legacy (get+set) → true
- `isWritable(v)`: داشتن `set` تابعی (contract نوشتنی مثل قبل)
- `Signal.prototype[ZENITH_READABLE] = true` و `Computed.prototype[...] = true`

`runtime/createContext` از `isReadable` استفاده می‌کند (unwrap واکنشی با getter)؛
جایی‌هایی که **می‌نویسند** (`zen-model`، `hydrate.ts:353`) همچنان `set` الزامی
دارند — نوشتن روی computed باید ناموفق/هشدار بماند نه اینکه بی‌صدا پاس شود.

## پیامدها

- `computed` در template زنده کار می‌کند (تأیید: unit + jsdom + Playwright روی
  باندل مرورگری واقعی: 0→2→6).
- سازگاری backward: آبجکت‌های plain get+set دقیقاً مثل قبل Signal رفتار
  می‌کنند؛ serviceها (بدون get یا بدون برند) دست‌نخورده در context می‌مانند.
- API عمومی state سه خروجی جدید دارد: `isReadable`, `isWritable`,
  `ZENITH_READABLE` (اضافه بر contract موجود؛ breaking نیست).
- README ریشه از الگوی workaround (signal+effect) به `computed` ساده برگشت.
