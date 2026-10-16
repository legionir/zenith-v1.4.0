# API Reference: `zenith/presets/minimal`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/presets/minimal.ts`
- **کلید exports**: `./presets/minimal` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `App` | `type` | `@public` |
| `AppOptions` | `type` | `@public` |
| `createApp` | `value` | `@public` |
| `createMinimalApp` | `function` | `@public` |
| `definePlugin` | `value` | `@public` |
| `events` | `value` | `@public` |
| `minimalPreset` | `const` | `@public` |
| `PRESET_MINIMAL_MODULES` | `const` | `@public` |
| `security` | `value` | `@public` |
