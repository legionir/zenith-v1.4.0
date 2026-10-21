# API Reference: `zenith/presets/spa`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/presets/spa.ts`
- **کلید exports**: `./presets/spa` (ESM-only؛ DEC-027)
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
| `createSpaApp` | `function` | `@public` |
| `definePlugin` | `value` | `@public` |
| `errorBoundary` | `value` | `@public` |
| `form` | `value` | `@public` |
| `http` | `value` | `@public` |
| `i18n` | `value` | `@public` |
| `minimalPreset` | `value` | `@public` |
| `notifications` | `value` | `@public` |
| `PRESET_SPA_MODULES` | `const` | `@public` |
| `resource` | `value` | `@public` |
| `router` | `value` | `@public` |
| `spaPreset` | `const` | `@public` |
| `store` | `value` | `@public` |
