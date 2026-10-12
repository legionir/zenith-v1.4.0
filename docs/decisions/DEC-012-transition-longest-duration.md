# DEC-012: پایان transition بر اساس طولانی‌ترین duration محاسبه‌شده از computed style

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #23

## زمینه

`createTransition` با اولین `transitionend`/`animationend` که target آن خود
المان بود `finish(true)` می‌کرد. با CSS چندproperty (opacity 0.1s +
transform 0.5s) المان در ۰٫۱s «تمام» حساب می‌شد و `onAfterLeave` اجرا می‌شد
در حالی‌که transform هنوز ادامه داشت → حذف زودهنگام المان.

## گزینه‌ها

1. `element.getAnimations()` + `Promise.all(a.finished)` — دقیق ولی در jsdom
   در دسترس نیست (تست واحد)، و رفتار با animationهای بی‌ربط/بی‌نهایت شکننده.
2. محاسبهٔ مدت از `getComputedStyle` (بیشینهٔ delay+duration transitionها و
   delay+duration×iterations animationها) + gate کردن رویدادها با
   `elapsedTime` — قابل‌تست در jsdom و مرورگر واقعی، deterministic.
3. شمارش تعداد propertyها — آسان‌تر ولی durationهای واقعی را نمی‌بیند.

## تصمیم و دلیل

گزینهٔ ۲ (هر دو بند «کارهای لازم» issue این را پیشنهاد می‌کند). `onEnd`:
target-self و `event.elapsedTime × 1000 >= expectedEndMs` لازم است؛
تایمر fallback به `max(duration, expectedEndMs) + 50` تمدید می‌شود.
`infinite`/تکرارهای خیلی زیاد به سقف `MAX_COUNTED_ITERATIONS=100` و
`SAFE_CAP_MS=30s` محدود می‌شوند تا hang نامتناظر ایجاد نشود (ایمنی).
`measureTransitionDuration` در JS render (SSR) صدا زده نمی‌شود — فقط داخل
run در مرورگر.

## پیامدها

- `onAfterLeave` بعد از طولانی‌ترین transition/animation اجرا می‌شود (e2e Chromium: ≥۴۰۰ms برای ۵۰۰ms).
- رویدادهای bubbleشده از فرزندان نادیده گرفته می‌شوند (target-check از قبل بود، e2e اثبات می‌کند).
- المان بی‌CSS-transition مثل قبل با duration تنظیم‌شده تمام می‌شود (سازگاری رو به جلو).
- تست‌ها: unit jsdom `transition-longest-duration.test.ts` + e2e `e2e/transition.spec.ts`.
