# API Reference: `@zenith/schema/attr`

- **پکیج والد**: `schema` — [`schema.md`](./schema.md)
- **فایل منبع**: `packages/schema/src/attr.ts`
- **کلید exports**: `./attr` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `parseConfigAttr` | `function` | `@public` |
| `parseJsonAttr` | `function` | `@public` |
| `ParseJsonAttrOptions` | `interface` | `@public` |
| `parseJsonValue` | `function` | `@public` |
