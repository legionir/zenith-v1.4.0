// packages/security/src/secure-id.ts
//
// #119 — یکسان‌سازی `secureId`: پیش از این دو پیاده‌سازی byte-identical در
// `@zenith/shared` و `@zenith/security` وجود داشت (نام export عمومی تکراری).
// پیاده‌سازی در L0 (`@zenith/shared/src/id.ts`) می‌ماند — تنها جایی که می‌تواند
// بدون چرخه (`security → logger → shared`) منبع یکتا باشد — و اینجا فقط
// به‌عنوان API رسمی پکیج امنیت re-export می‌شود (DEC-014 حفظ می‌شود:
// `@zenith/security` همچنان `secureId` را export می‌کند).

export { secureId } from '@zenith/shared';
