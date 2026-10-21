# API Reference: `@zenith/unplugin-zenith/vite`

- **پکیج والد**: `unplugin-zenith` — [`unplugin-zenith.md`](./unplugin-zenith.md)
- **فایل منبع**: `packages/unplugin-zenith/src/vite.ts`
- **کلید exports**: `./vite` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `node`

## چرا زیرمسیر؟

زیرمسیرهای پنج bundler هستهٔ یکتای compile را بدون کشیدن وابستگیِ bundlerِ
دیگر عرضه می‌کنند (#164): مصرف‌کنندهٔ Vite فقط `./vite` را بار می‌کند.
شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `PLUGIN_VERSION` | `const` | `@public` |
| `zenithVite` | `function` | `@public` |
