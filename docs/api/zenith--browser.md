# API Reference: `zenith/browser`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/browser.ts`
- **کلید exports**: `./browser` (ESM-only؛ DEC-027)
- **محیط هدف (`zenith.target`)**: `universal`

## چرا زیرمسیر؟

زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند
(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را
بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`
(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `assertCompatible` | `value` | `@public` |
| `batch` | `value` | `@public` |
| `computed` | `value` | `@public` |
| `createApp` | `value` | `@public` |
| `defineDirective` | `value` | `@public` |
| `definePlugin` | `value` | `@public` |
| `effect` | `value` | `@public` |
| `flushSync` | `value` | `@public` |
| `hydrate` | `value` | `@public` |
| `inject` | `value` | `@public` |
| `installBrowserGlobal` | `function` | `@public` |
| `onMount` | `value` | `@public` |
| `onUnmount` | `value` | `@public` |
| `onUpdate` | `value` | `@public` |
| `provide` | `value` | `@public` |
| `scheduleEffect` | `value` | `@public` |
| `signal` | `value` | `@public` |
| `startFromSSR` | `value` | `@public` |
| `untrack` | `value` | `@public` |
| `useApp` | `value` | `@public` |
| `watch` | `value` | `@public` |
| `ZenithBrowser` | `const` | `@public` |
