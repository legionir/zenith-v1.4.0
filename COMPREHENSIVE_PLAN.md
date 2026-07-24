=== پلن جامع رفع کمبودها ===

فاز A: رفع واقعی audit باقیمانده (۳۹ باگ)
A1. audit/all.md Phase 1 (Critical): BUG-CLI-01..05 — اصلاح templates/check (واقعی در cli/src/)
A2. audit/all.md Phase 2 (High): BUG-TRN-02..04 — transition timing (واقعی در transition/src/)
A3. audit/all.md Phase 2: BUG-EB-01 — error-boundary catch (واقعی در error-boundary/)
A4. audit/all.md Phase 2: BUG-FRM-01..04 — form validation/fix (واقعی در form/src/)
A5. audit/all.md Phase 3: BUG-DEV-02..03 — devtools cleanup (واقعی در devtools/src/)
A6. audit/all.md Phase 4 (Medium): BUG-RTR-01..03 — router cleanup (واقعی در router/src/)
A7. audit/all.md Phase 4: BUG-DAT-01..04 — data fetch/abort (واقعی در data/src/)
A8. audit/all.md Phase 4: BUG-STORE-01 — store deepProxy (واقعی در store/src/)
A9. audit/all.md Phase 4: BUG-STATE-01/03 — state batch/computed (واقعی در state/src/)
A10. audit/all.md Phase 5: BUG-EXP-B-01/02/09 — expressions (واقعی در expressions/src/)
A11. audit/all.md Phase 5: BUG-COMP-01/04/05/06/07 — compiler fixes (واقعی در compiler/src/)
A12. audit/all.md Phase 5: BUG-SW-02..05 — service worker sync/cache (واقعی در service-worker/src/)

فاز B: رفع listener leaks (تمام فایل‌ها)
B1. packages/devtools/src/hook.ts — cleanupStateSubscribers + removeEventListener (انجام)
B2. packages/service-worker/src/sw.ts — swHandlers + cleanupSWListeners (انجام)
B3. packages/runtime/src/directives/date-picker.ts — _listeners + dispose() (انجام)
B4. packages/vite-plugin/src/compile.ts — بررسی واقعی listener (بدون listener واقعی مورد نیاز)
B5. packages/vscode-extension/src/extension.ts — بررسی واقعی listener (بدون listener واقعی مورد نیاز)

فاز C: رفع validator (واقعی)
C1. packages/expressions/src/validator.ts — حذف کامل eval از کد (نه فقط کامنت)
C2. packages/expressions/src/evaluator.ts — بررسی استفاده از eval و حذف/جایگزینی
C3. اضافه کردن تست برای جلوگیری از eval

فاز D: تکمیل فروشگاه (persist + inventory)
D1. ecommerce-demo/src/store.ts — اضافه کردن persist (IndexedDB) برای cart/state
D2. ecommerce-demo/src/store.ts — اضافه کردن inventory tracking (decrement on order)
D3. ecommerce-demo/pages/checkout.html — اتصال به inventory
D4. ecommerce-demo/pages/confirmation.html — تأیید سفارش با موجودی به‌روز
D5. اضافه کردن inventory check در store actions (addToCart با بررسی موجودی)

فاز E: رفع فاصله مستند و واقعیت
E1. بررسی هر BUG-... FIX در audit/all.md با کد منبع متناظر
E2. اگر مستند بدون کد بود → اعمال کد واقعی
E3. اگر کد بدون مستند بود → به‌روزرسانی مستندات
E4. ایجاد test parity (test برای هر fix)

فاز F: اعتبارسنجی نهایی
F1. اجرای test برای همه باگ‌های رفع شده
F2. اجرای benchmark برای performance
F3. اجرای security audit (fuzzing)
F4. بررسی type-check با strict mode
F5. مستندسازی نهایی تغییرات
