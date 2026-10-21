# API Reference: `@zenith/unplugin-zenith/esbuild`

- **پکیج والد**: `unplugin-zenith` — [`unplugin-zenith.md`](./unplugin-zenith.md)
- **فایل منبع**: `packages/unplugin-zenith/src/esbuild.ts`
- **کلید exports**: `./esbuild` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `node`

## چرا زیرمسیر؟

زیرمسیرهای پنج bundler هستهٔ یکتای compile را بدون کشیدن وابستگیِ bundlerِ
دیگر عرضه می‌کنند (#164). شکل و فهرست زیرمسیرها از
`scripts/lib/exports-shape.mjs` (`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `zenithEsbuild` | `const` | `@public` |
