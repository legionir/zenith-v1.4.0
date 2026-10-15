# DEC-033: دو console.error جدید در CLI برای دستور `zenith telemetry` — بالارفتن سقف error-hygiene از 201 به 203

- وضعیت: پذیرفته‌شده (موج ۶، P2 Batch 5)
- تاریخ: 2026-10-13
- مرتبط: #94 (telemetry اختیاری)، #115 (error-hub/ceiling)، #39 (مهاجرت به @zenith/logger)، #143 (لیست مجاز no-console)

## زمینه

دستور `zenith telemetry on|off|status` (#94) پیاده شد. `scripts/error-hygiene.mjs` سقف
ceiling برابر 201 برای شمارش `console.error`/`console.warn` در `packages/*/src` دارد و
قاعدهٔ «فقط رو به پایین» را اعمال می‌کند؛ نصب جدید شمارش را 203 می‌کند.

دو فراخوان جدید:

1. `packages/cli/src/telemetry.ts` — گزارش action ناشناختهٔ دستور به stderr
   (بازگشت exit code 1؛ الگوی همان فایل‌های CLI موجود مثل check/index که در
   فهرست مجاز NO_CONSOLE_RATCHET هستند).
2. `packages/cli/src/index.ts` — پیام «zenith telemetry: خطای داخلی» در catch
   import دینامیک (دقیقاً الگوی `create-zenith` و دستور `ssg` در همان فایل).

توجه: پیام‌های خروجی عادی دستور (status/on/off) با `console.log` چاپ می‌شوند و
مشمول این سقف نیستند؛ همچنین `packages/cli/src/telemetry.ts` به فهرست
`scripts/no-console-ratchet.mjs` اضافه شده است (#143).

## تصمیم

بالارفتن سقف از **201 به 203** با این DEC مستند و پذیرفته می‌شود، زیرا:

1. CLI مرز تعامل با کاربر است و console در آن جا قرارداد UX است (نه لاگ
   داخلی) — همان استثنایی که برای check/index/lighthouse/templates ثبت شده.
2. امکان جایگزینی با `process.stderr.write` وجود دارد اما معنایی را بهبود
   نمی‌دهد و از انسجام با بقیهٔ CLI (که از console استفاده می‌کند) می‌کاهد.
3. مهاجرت یک‌جای CLI به `@zenith/logger` در دامنهٔ #39 است و با آن همگام
   خواهد شد؛ آن زمان سقف به 201 بازمی‌گردد (و در ادامه پایین‌تر).

## عواقب

- `scripts/error-hygiene.mjs`: `CONSOLE_CEILING = 203` با ارجاع به این DEC.
- هر فراخوان console.error/warn جدید خارج از دامنهٔ CLI همچنان ممنوع است و
  سقف فقط با DEC جدید قابل تغییر است.
