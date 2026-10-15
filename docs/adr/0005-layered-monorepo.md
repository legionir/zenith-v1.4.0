# ADR-0005: مونوریپوی لایه‌ای L0–L5 + Tooling با اجرای dependency-cruiser

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-022](../decisions/DEC-022-adapter-edge-deferred.md) • [DEC-025](../decisions/DEC-025-runtime-core-split-parity.md) • [DEC-034](../decisions/DEC-034-exports-shape-dts-bundle-require-esm.md)

## Context and Problem Statement

با ۴۹ پکیج، بدون قاعدهٔ روشن وابستگی، هر پکیج هر پکیجی را import می‌کند:
`state` به `devtools`، `events` به `router`، `runtime-core` به ابزار build.
نتیجه: چرخه، ناتوانی در استفادهٔ مستقل از یک پکیج و bundle متورم.

## Decision Drivers

- جهت وابستگی باید یک‌طرفه و قابل خواندن باشد: از L0 (پایه) به L5 (چتر).
- مرز باید **اجراشده** باشد، نه توصیه‌شده (گیت CI، نه سند).
- منبع یکتای نقشهٔ لایه‌ها برای config، گراف و تست.
- مسیر مهاجرت بدون شکستن API موجود (alias + deprecate؛ DEC-026).

## Considered Options

1. بدون قاعده، فقط بازبینی کد در PR.
2. قاعده در ESLint (`no-restricted-imports`) به ازای هر پکیج.
3. **نقشهٔ لایه در یک فایل JSON** + قواعد `forbidden` در dependency-cruiser + گراف SVG در CI.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `scripts/architecture-layers.json` منبع یکتاست؛
`.dependency-cruiser.cjs` قواعد `layer-lX-no-upward`، `no-deep-import`،
`no-runtime-to-tooling` و قواعد معکوس صریح (`no-events-to-router`،
`no-state-to-devtools`، `no-runtime-to-i18n`) را روی گرافِ resolve‌شده به **src**
اعمال می‌کند (`tsconfig.depcruise.json`؛ بدون آن importها از `dist` resolve
می‌شدند و قواعد بی‌اثر بودند). گراف SVG هر اجرای CI به‌عنوان artifact منتشر
می‌شود و خلاصهٔ ماشین‌خوانش در `docs/ARCHITECTURE-GRAPH.md` است.

### Consequences

- ✅ چرخهٔ استاتیک ممنوع؛ `npm run deps` اجبارکننده است.
- ✅ افزودن پکیج جدید فقط با ثبت در JSON + لایهٔ درست ممکن است (تست `architecture-layers` سند را هم‌گام نگه می‌دارد).
- ⚠️ یک استثنای مستند وجود دارد: `runtime → devtools` (re-export سازگاری، حذف در ۲.۰) و به‌صورت یال نارنجی/خط‌چین در گراف دیده می‌شود.
- ⚠️ deep import ممنوع است؛ هر چیزی که لازم است باید در entry عمومی pکیج باشد (`exports`).

## Links

- [docs/ARCHITECTURE-LAYERS.md](../ARCHITECTURE-LAYERS.md)
- [docs/ARCHITECTURE-GRAPH.md](../ARCHITECTURE-GRAPH.md)
- [scripts/architecture-layers.json](../../scripts/architecture-layers.json)
