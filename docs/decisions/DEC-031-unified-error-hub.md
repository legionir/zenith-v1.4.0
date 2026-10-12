# DEC-031: مدل خطای واحد و hub سراسری

- وضعیت: پذیرفته‌شده (موج ۲، P0)
- تاریخ: 2026-10-11
- مرتبط: #115، #171 (DEC-020 کد ۴رقمی)، #116 (Cleanup)، #112 (لینک مستندات)

## زمینه

سه سیستم خطای موازی وجود داشت:

1. `@zenith/state` (`error.ts`): `onError/emitError/errorBoundary/getErrorHistory/setDevMode` با
   interface `ZenithError` (فیلدهای `severity/recoverable/hint/timestamp`).
2. `@zenith/error-boundary` (`boundary.ts`): `onError/reportError/errorSignal/clearError` با
   interface `ZenithError` دوم (`source/expression/element/error`).
3. `@zenith/errors`: کلاس `ZenithError` (`code/category/suggestion/details/docsUrl`) — مدل مرجع
   که بقیهٔ پکیج‌ها (L0) از آن مصرف می‌کنند.

همچنین `onEffectError` (state) و `setSchedulerHooks.onError` (scheduler) مسیرهای جانبی جدا بودند
و در `src` ده‌ها `throw new Error` ساده و پیشوندهای ناهمگون (`[Zenith]`, `[zen-*]`, …) وجود داشت.

## تصمیم

**hub واحد در `@zenith/errors`** (`src/hub.ts`) تنها مسیر انتشار خطاست:

- `onError(handler): Cleanup` — ثبت listener (از راه‌اندازی تا حذف؛ دوباره‌ثبت بی‌اثر).
- `emitError(err: ZenithError)` — sink مشترک: history حلقوی (۵۰)، log لاغر بدون `console.*` مستقیم
  (logger تزریق‌پذیر `setErrorLogger`)، devMode.
- `getErrorHistory()/clearErrorHistory()/setDevMode()/isDevMode()` به errors منتقل و از `state`
  re-export می‌شوند (بدون تغییر name برای مصرف‌کنندهٔ موجود).
- `state.ZenithError` (interface) حذف می‌شود و **بنام** `errors.ZenithError` (class) alias
  تایپ‌_only_ می‌گردد. `severity` و `hint` روی همان class اضافه شدند (فیلد جدید اختیاری، سازگار
  با TO JSON در DEC-029)؛ `recoverable` حذف شد (بی‌مصرف — در هیچ consumer خوانده نمی‌شد).
- `error-boundary` دیگر listener مستقل ندارد: `onError/reportError/clearError/clearErrorBoundary`
  wrapper روی hub هستند؛ `errorSignal` (وابسته به state) در boundary ساخته می‌شود و هر خطای
  ارسالی به hub در آن منعکس می‌گردد. type `ZenithErrorInfo = ZenithError & { source, expression?,
  element? }` جای interface قدیمی را می‌گیرد (ساختاراً oversets از class؛ emitError همان آبجکت را
  به listenerها می‌دهد).
- `onEffectError` و `SchedulerHooks.onError` **حذف نمی‌شوند** (schedule-path بدون consumer
  خارجی) ولی خطا را دیگر خودشان پخش نمی‌کنند: effect مسیر را به `emitError` تبدیل می‌کند و
  scheduler hook فقط observer است.
- کدهای جدید (DEC-020، بازهٔ runtime): `ZEN-905` runtime directive/expression failure،
  `ZEN-906` reactivity (effect) failure، `ZEN-907` framework misuse (generic developer errors)،
  `ZEN-908` SSR hydration mismatch. `reportError` از `toZenithError` + `ZEN-905` استفاده می‌کند.
- ۴۰ مورد `throw new Error` در لایهٔ framework (state/scheduler-adjacent، actions، components،
  ssr، store، data، service-worker، runtime، events/modifiers، transition، virtual-list، resource/crud/auth)
  به `ZenithError` با کد ZEN تبدیل شدند (از baseline ۶۶؛ ۲۶ مورد باقی‌مانده همگی در allowlist).
  موارد توجیه‌شده در allowlist ماندند (parse-error در expressions که به `EXPRESSION_SYNTAX_ERROR`
  تبدیل می‌شوند، tooling/internal invariants، زیرسهام cli/lighthouse، shared/assert fallback).
- اسکریپت گیت `scripts/error-hygiene.mjs`: `throw new Error` بدون allowlist، `export interface ZenithError`،
  export عمومی `onError` خارج از errors/hub، و ceiling شمارش `console.error/warn` در packages/*/src
  را در CI بررسی می‌کند. ceiling واقعی: **۲۰۲** (از baseline ۲۴۷ در این موج کاهش یافت؛ هدف‌های
  پلکانی ۱۲۰/۸۰/۴۰ در #112/#137 و موج‌های بعدی — فقط رو به پایین).

گزینه‌ها: (الف) hub در `state` — رد: state L1 است و L0ها (logger/http/i18n…) نمی‌توانند import
کنند؛ (ب) پکیج جدید `@zenith/error-hub` — رد: حجم API کوچک است و errors همین حالا مرجع کد/کلاس
است؛ (ج) hub در `errors` (انتخاب).

## پیامد

- یک `onError` عمومی؛ `grep` names تکراری فقط re-export هستند.
- مصرف‌کنندهٔ قدیمی (`Zen.reportError(message, opts)`, `emitError({…})` state) باید payload
  class-محور بدهد؛ signature جدید `emitError` آبجکت partial `ZenithError`-like را هم می‌پذیرد
  و با `toZenithError` نرمال‌ایز می‌کند تا شکست نرم داشته باشیم (بدون deprecation حذفی).
- logger sink: `console.*` مستقیم در error-path حذف؛ پیش‌فرض logger خود hub از `console` استفاده
  می‌کند ولی از طریق `__zenithLog` (تست‌پذیر).
- coverage تست یکپارچگی: directive/effect/scheduler هر سه به یک listener می‌رسند.
- بودجهٔ size: hub منطق جدید به مسیر runtime اضافه می‌کند؛ bundle مرورگر از ۵۰ به ۵۱ kB
  (brotli 330B>50kB) رسید. سقف `.size-limit.json` فقط به عدد واقعی بعدی (۵۱) بالا رفت —
  این «شل‌کردن گیت» نیست، بازتاب افزودن کد اجتناب‌ناپذیر است؛ کاهش در #137/#112 هدف‌گیری می‌شود.
