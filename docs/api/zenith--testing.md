# API Reference: `zenith/testing`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/testing.ts`
- **کلید exports**: `./testing` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

این زیرمسیر چیزی خودش تعریف نمی‌کند؛ همهٔ نمادها از پکیج
`@zenith/testing` بازصادر می‌شوند:
[`testing.md`](./testing.md)
