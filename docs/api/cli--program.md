# API Reference: `@zenith/cli/program`

- **پکیج والد**: `cli` — [`cli.md`](./cli.md)
- **فایل منبع**: `packages/cli/src/program.ts`
- **کلید exports**: `./program` (dual ESM+CJS؛ مثل ورودی اصلی)
- **محیط هدف (`zenith.target`)**: `node`

## چرا زیرمسیر؟

ورودی اصلی `@zenith/cli` با import اجرا می‌شود (`runCli` روی import صدا زده
می‌شود — همان side-effectی که در `sideEffects` پکیج ثبت است). مصرف‌کننده‌ای
که فقط برنامهٔ Commander را می‌خواهد (تست، ابزار سفارشی، `info`) با
`@zenith/cli/program` به `createProgram` می‌رسد بدون اینکه CLI اجرا شود.
شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `createProgram` | `function` | `@public` |
| `runCli` | `function` | `@public` |
