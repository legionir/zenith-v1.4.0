# API Reference: `zenith/presets/full`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/presets/full.ts`
- **کلید exports**: `./presets/full` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `actions` | `value` | `@public` |
| `App` | `type` | `@public` |
| `AppOptions` | `type` | `@public` |
| `auth` | `value` | `@public` |
| `cache` | `value` | `@public` |
| `components` | `value` | `@public` |
| `createApp` | `value` | `@public` |
| `createFullApp` | `function` | `@public` |
| `definePlugin` | `value` | `@public` |
| `fullPreset` | `const` | `@public` |
| `jalali` | `value` | `@public` |
| `PRESET_FULL_MODULES` | `const` | `@public` |
| `spaPreset` | `value` | `@public` |
| `storage` | `value` | `@public` |
| `suspense` | `value` | `@public` |
| `transition` | `value` | `@public` |
