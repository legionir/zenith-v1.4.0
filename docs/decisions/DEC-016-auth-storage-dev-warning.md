# DEC-016 — هشدار dev ذخیرهٔ ناامید توکن با کد ZEN-404 (شامل sessionStorage)

- **تاریخ:** 2026-10-10
- **وضعیت:** پذیرفته‌شده
- **مرتبط:** Issue #62، `packages/auth/src/auth.ts`، `docs/security/auth.md`، DEC-014

## زمینه

`AuthConfig.tokenStorage` چهار مقدار می‌پذیرد؛ پیش‌فرض از v1.2.6 `memory` است.
Issue #62 خواستار «هشدار dev هنگام انتخاب `localStorage`/`cookie` برای توکن حساس»
با کد ZEN بود. سه تصمیم غیربدیهی وجود داشت:

1. آیا `sessionStorage` هم هشدار بگیرد؟
2. کد خطا: خطای واقعی (throw) یا فقط هشدار کنسول، و چه کدی؟
3. مکانیزم dev/prod: از کدام flag استفاده شود؟

## تصمیم

1. **`sessionStorage` هم هشدار می‌گیرد.** تهدید (خواندن توکن توسط JS صفحه در
   حضور XSS) عیناً برقرار است؛ تفاوتش فقط عمر tab است. سازگاری با متن issue
   حفظ شده (localStorage/cookie حتماً؛ sessionStorage فراتر از متن issue ولی امن‌تر).
2. **هشدار، نه throw** — با کد **ZEN-404**
   (`ErrorCode.SECURITY_INSECURE_TOKEN_STORAGE` در `@zenith/errors`, بازهٔ
   Security ZEN-400..499). انتخاب storage یک تصمیم آگاهانهٔ برنامه‌نویس است؛
   break کردن اپ تولیدی به‌خاطر آن acceptable نیست. پیام هشدار به راهنمای
   `docs/security/auth.md` ارجاع می‌دهد.
3. **الگوی موجود `globalThis.__ZENITH_DEV__ !== false`** (مثل `sanitizeHTMLTrusted`
   در security، `boundary` و `compiler`). flag جدید یا env-based بررسی
   `process.env.NODE_ENV` اضافه نشد — در bundle مرورگری قابل‌اطیاع است و pattern
   از قبل در کدبیس جا افتاده.

## پیامدها

- تست‌ها: `packages/auth/test/auth-security.test.ts` هر چهار حالت (dev+localStorage،
  dev+cookie، memory بدون هشدار، prod بدون هشدار) را قفل می‌کند.
- ZEN-404 فقط یک شناسهٔ متنی در `ErrorCode` است؛ `securityError()` هنوز دامنهٔ
  union‌اش `ZEN-002/003/401` است — تغییر آن API-breaking بود و انجام نشد.
- نویز کنسول برای کاربرانی که آگاهانه localStorage انتخاب کرده‌اند: با یک خط
  `__ZENITH_DEV__ = false` خاموش می‌شود؛ در راهنما مستند است.
