# API Reference: `@zenith/schema/zod`

- **پکیج والد**: `schema` — [`schema.md`](./schema.md)
- **فایل منبع**: `packages/schema/src/zod.ts`
- **کلید exports**: `./zod` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `fromZod` | `function` | `@public` |
| `validateWithZod` | `function` | `@public` |
| `ZodLike` | `interface` | `@public` |
