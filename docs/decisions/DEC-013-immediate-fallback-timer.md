# DEC-013: fallback timer فوری (همزمان با شروع run) به‌جای بعد از دو rAF

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #24

## زمینه

در `createTransition` تایمر fallback بعد از دو `requestAnimationFrame` ساخته
می‌شد. در تب پس‌زمینه rAF متوقف است؛ پس `finish` هرگز اجرا نمی‌شد،
`finished` resolve نمی‌شد و المان منتظر leave (حذف پس از خروج) برای همیشه
می‌ماند.

## گزینه‌ها

1. `setTimeout` بلافاصله در شروع run؛ تمدید در rAF دوم اگر مدت واقعی بزرگ‌تر باشد (بند #23).
2. `setTimeout` فوری بدون تمدید — با #23 تداخل دارد (زودتمام‌شدن در CSS طولانی).
3. observer برای visibilitychange — پیچیده و قابل‌دورزدن.

## تصمیم و دلیل

گزینهٔ ۱: تایمر initial با `duration+50` همزمان با addEventListenerها و
پیش از rAF ساخته می‌شود؛ در rAF دوم (اعمال کلاس مقصد) اگر
`measureTransitionDuration > duration` باشد تایمر به
`expectedEndMs + 50 − elapsed` تمدید می‌شود (clearTimeout قبلی).
در `finish` و `cancel` همان مسیر قبلی `clearTimeout(timer)` حفظ است — بدون نشت.

## پیامدها

- با rAF متوقف، `finished` حداکثر `duration + margin` بعد resolve می‌شود (تست unit با rAF استوب‌شده).
- بدون تغییر رفتار در حالت عادی (rAF فعال): deadline فقط بزرگ‌تر یا برابر previous behavior است.
- تست‌ها: `transition-fallback-timer.test.ts` (۳ مورد).
