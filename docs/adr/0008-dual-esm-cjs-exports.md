# ADR-0008: انتشار دوگانه ESM/CJS، شکل `exports` و یک `.d.ts` تجمیع‌شده برای هر ورودی

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-027](../decisions/DEC-027-node-floor-dual-format.md) • [DEC-034](../decisions/DEC-034-exports-shape-dts-bundle-require-esm.md) • [DEC-008](../decisions/DEC-008-package-fields.md)

## Context and Problem Statement

مصرف‌کنندگان ما هم پروژهٔ ESM جدیدند و هم پروژهٔ CJS قدیمی‌تر (Jest/Vite قدیمی).
`main`/`module`/`types` در ترکیب با `type: module` به «FalseESM» و خطای
`ERR_PACKAGE_PATH_NOT_EXPORTED` منجر می‌شد (سه نقص واقعی در #74 کشف شد)، و
`require('@zenith/state')` شکست می‌خورد.

## Decision Drivers

- هر دو دنیا باید بدون build اضافه کار کنند (با تایپ‌های درست در هر دو حالت).
- یک قاعدهٔ واحد برای همهٔ ۴۹ پکیج (بدون حالت استثنایی دستی).
- گیت‌های قابل اجرا: `publint`، `attw`، نصب tarball و import واقعی در CI.
- بدون dual-package hazard برای singletonها (DEC-018).

## Considered Options

1. ESM-only (شکستن مصرف‌کنندهٔ CJS).
2. هر پکیج با شکل دلخواه `exports` (ناهمگونی و باگ‌های پنهان).
3. **شکل واحد از یک منبع مشترک** (`scripts/lib/exports-shape.mjs`) + باندل نوع + `require(esm)`.

## Decision Outcome

گزینهٔ ۳ انتخاب شد: `import`/`require` هر دو به ترتیب به `dist/index.js` و
`dist/index.cjs` با تایپ‌های جدا (`index.d.ts`/`index.d.cts`) اشاره می‌کنند؛
شکل `exports` تنها از `scripts/lib/exports-shape.mjs` تولید می‌شود (دستی
نوشتن ممنوع). تایپ‌ها با `rollup-plugin-dts` به یک فایل تجمیع‌شده به‌ازای هر
ورودی باندل می‌شوند و پکیج‌های ESM-only با `require(esm)` سازگار می‌مانند
(DEC-034). گیت‌ها: `npm run publint`، `node scripts/attw-all.mjs`,
`node scripts/install-import-check.mjs`, `npm run dts-parity`.

### Consequences

- ✅ مصرف‌کنندهٔ CJS و ESM هر دو تایپ درست می‌گیرند؛ `attw` سبز است.
- ✅ افزودن پکیج جدید فقط با تولید `exports` از منبع مشترک ممکن است.
- ⚠️ `rollup-plugin-dts` یک devDependency با استثنای لایسنس build-only است (بدون تأیید کتبی مالک؛ `scripts/check-licenses.mjs`).
- ⚠️ `require(esm)` به Node ≥20.19/22.12 در مسیر CJS وابسته است؛ مستند در DEC-027/034.

## Links

- [docs/VERSIONING-STRATEGY.md](../VERSIONING-STRATEGY.md)
- [scripts/lib/exports-shape.mjs](../../scripts/lib/exports-shape.mjs)
- [docs/decisions/DEC-034-exports-shape-dts-bundle-require-esm.md](../decisions/DEC-034-exports-shape-dts-bundle-require-esm.md)
