---
name: New Package (SPEC §6)
about: Scaffold and acceptance checklist for a new @zenith/* package
title: '[NEW-PKG] @zenith/<name> (<layer>): <summary>'
labels: ['new-package', 'source:NEWPKG']
---

## مشخصات پکیج (SPEC §6.1)

- **نام پکیج:** `@zenith/<name>`
- **لایه:** `L0` | `L1` | `L2` | `L3` | `L4` | `L5` | `tooling`
- **دستور ساخت اسکلت:** `npm run new:package -- <name> --layer <layer>`
- **نسخه:** `1.5.0` (lockstep — DEC-026)
- **فرمت:** ESM-only برای L0–L5؛ dual ESM+CJS برای `tooling` (DEC-027)
- **Peerها:** `@zenith/state` و `@zenith/scheduler` فقط برای L1+ (DEC-018)

## چک‌لیست معیار پذیرش (SPEC §6.2)

- [ ] لایه و وابستگی‌ها مطابق بند ۱؛ `dependency-cruiser` سبز.
- [ ] `XOptions` با schema و `DEFAULTS`؛ تست «پیش‌فرض‌ها + مقدار نامعتبر».
- [ ] هر `createX` دارای `dispose()` و تست idempotency/نشت.
- [ ] هر directive دارای `DirectiveMeta` و ورودی در `zenith.meta.json`.
- [ ] کدهای خطای بازهٔ خودش در `@zenith/errors` ثبت شده و مستند است.
- [ ] SSR: تست رندر سرور، hydration بدون mismatch، یا `client-only` صریح.
- [ ] a11y: axe بدون نقض `serious`+؛ کیبورد کامل برای کامپوننت‌های تعاملی.
- [ ] بودجهٔ حجم (`size-limit`) و tree-shaking (import یک تابع ⇒ فقط همان).
- [ ] README (نصب، مثال، جدول گزینه‌ها و attributeها)، TypeDoc، `CHANGELOG`.
- [ ] `api-extractor` snapshot؛ هیچ export داخلی در `index.ts`.
- [ ] بدون `console.*`، `throw new Error` ساده، `any` در API عمومی، `Math.random` امنیتی.
- [ ] تست در Node 18.19/20/22 و مرورگرهای Chromium/Firefox/WebKit.
