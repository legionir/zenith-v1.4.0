# DEC-010: untrack کردن همهٔ callbackهای کاربر در virtual-list

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #19

## زمینه

در `createVirtualList` تابع `update()` داخل `effect()` اجرا می‌شد و callbackهای
کاربر (`renderItem`، `getItemKey`، `itemSize` تابعی، `onVisibleRangeChange`) را
مستقیم صدا می‌زد. هر signalی که در این callbackها خوانده می‌شد به وابستگی
effect تبدیل می‌شد: تغییر یک signal بیرونی → بازسازی کامل لیست، و نوشتن
signal وابسته در `onVisibleRangeChange` → حلقهٔ بی‌نهایت.

## گزینه‌ها

1. `untrack()` دور تک‌تک فراخوانی‌های callback — استاندارد reactive (Solid/Preact Signals) برای «کد جانبی که نباید ترک شود».
2. حذف کامل `effect` و اشتراک دستی به `items.subscribe` — تغییر API داخلی بزرگ‌تر، نیاز به آستانهٔ نشتی در state.
3. مستندسازی به‌جای رفع — معیار پذیرش #19 را برآورده نمی‌کند.

## تصمیم و دلیل

گزینهٔ ۱: همهٔ callbackهای کاربر و توابع داده‌محور (`getItemKey`, `itemSize(fn)`,
`renderItem`, `onScroll`, `onVisibleRangeChange`) داخل `untrack()` اجرا می‌شوند.
تنها وابستگی reactive باقی‌مانده `items.get()` است. با این حال اگر کاربر
بخواهد به signal بیرونی واکنش نشان دهد، مسیر عمومی `refresh()` (و تغییر
خودِ `items`) موجود است. منطبق با قرارداد `AGENT-INSTRUCTIONS` بند ۱۰ (SSR-safe،
بدون وابستگی پنهان) و معیار پذیرش issue.

## پیامدها

- تغییر signal فقط‌خواندنی در `renderItem` دیگر رندر دوباره ایجاد نمی‌کند؛
  کاربر مسئول refresh با signalهای مورد نظرش است (رفتار صریح، قابل‌تست).
- حلقهٔ نوشتن در `onVisibleRangeChange` حذف شد (تست سقف‌دار).
- تست‌ها: `packages/virtual-list/test/controller-untrack.test.ts`.
