# DEC-025: تقسیم `runtime-core` — گروگان تست parity پیش از هر انتقال

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #148 (runtime-core/createApp)، #149 (zenith umbrella)، #173 (گرامر attribute)، SPEC §۲.۸

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۶: استخراج `runtime-core` (walker، context، attributes، hydrate، directiveهای پایه + createApp/defineDirective) از `runtime` فعلی، «پرریسک‌ترین مورد» خوانده شده؛ `runtime` باید به بستهٔ سازگار (runtime-core + ویژگی‌ها) تبدیل شود. شرط SPEC: «تست parity (compiler/runtime) قبل از انتقال لازم است».

## گزینه‌ها

- **الف) انتقال فیزیکی یک‌بارهٔ فایل‌ها به runtime-core** — هر رگرسیون رفتار walker/hydrate در نسخهٔ سازگار پنهان می‌ماند؛ debug بین دو نسخه غیرممکن. ❌
- **ب) parity-first: (۱) snapshot/parity suite روی `runtime` فعلی ساخته و در CI تثبیت می‌شود؛ (۲) مرز core/plugin طبق SPEC با `export`های internal علامت می‌خورد ولی فیزیکی منتقل نمی‌شود؛ (۳) انتقال تدریجی module-by-module فقط با سبز بودن parity؛ (۴) `runtime` = re-export + repackage، API دست‌نخورده.** ✅
- **ج) انصراف از تقسیم** — بودجهٔ حجم (`runtime-core ≤ 25 KB`) و هدف umbrella `zenith/core` را می‌کشد. ❌

## تصمیم و دلیل

گزینهٔ ب. سازگاری رو به عقب (§4.3 دستورالعمل) با اثبات‌پذیری: parity suite شامل خروجی HTML رشته‌به‌رشته برای هر directive هسته‌ای (zen-text/html/bind/model/show/if-chain/for/key/cloak/ref/memo/action)، ترتیب dispose، و مسیر hydrate (SSR→client) است؛ همان ورودی به `compiler` و همان markup. تا این suite در two-target (HEAD قدیم / HEAD جدید) diff صفر ندهد، هیچ فایل جابه‌جا نمی‌شود. createApp/#148 پس از تثبیت مرز انجام می‌شود؛ حذف singleton (#148) جدا از تقسیم فیزیکی است و می‌تواند زودتر با wrapper deprecate (الگوی DEC-019) آزاد شود.

## پیامدها

- #148 DoD: parity suite سبز + جدول dependency-cruiser جدید (core→{shared,logger,errors,security,expressions,events,error-boundary}) + بودجهٔ size-limit جدید؛ هیچ‌کدام بدون شواهد انجام‌شده حساب نمی‌شود.
- مصرف‌کنندهٔ نهایی تا ۲.۰ فقط `@zenith/runtime` می‌بیند؛ import از `runtime-core` اختیاری/پیش‌نمایش است.
- #173 (گرامر attribute) مرز تعریف‌شده در این ADR را مبنای «directive هسته vs افزونه» قرار می‌دهد.
