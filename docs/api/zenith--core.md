# API Reference: `zenith/core`

- **پکیج والد**: `zenith` — [`zenith.md`](./zenith.md)
- **فایل منبع**: `packages/zenith/src/core.ts`
- **کلید exports**: `./core` (ESM-only؛ DEC-027)
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
| `APP_OPTIONS_DEFAULTS` | `value` | `@public` |
| `AppOptions` | `type` | `@public` |
| `appOptionsSchema` | `value` | `@public` |
| `assertCompatible` | `value` | `@public` |
| `batch` | `value` | `@public` |
| `BindContext` | `type` | `@public` |
| `computed` | `value` | `@public` |
| `Computed` | `value` | `@public` |
| `createApp` | `value` | `@public` |
| `defineDirective` | `value` | `@public` |
| `definePlugin` | `value` | `@public` |
| `DirectiveDefinition` | `type` | `@public` |
| `effect` | `value` | `@public` |
| `flushSync` | `value` | `@public` |
| `hydrate` | `value` | `@public` |
| `HydrationMismatch` | `type` | `@public` |
| `HydrationResult` | `type` | `@public` |
| `inject` | `value` | `@public` |
| `isReadable` | `value` | `@public` |
| `isWritable` | `value` | `@public` |
| `MaybeSignal` | `type` | `@public` |
| `onMount` | `value` | `@public` |
| `onUnmount` | `value` | `@public` |
| `onUpdate` | `value` | `@public` |
| `Plugin` | `type` | `@public` |
| `provide` | `value` | `@public` |
| `ReadonlySignal` | `type` | `@public` |
| `scheduleEffect` | `value` | `@public` |
| `signal` | `value` | `@public` |
| `Signal` | `value` | `@public` |
| `startFromSSR` | `value` | `@public` |
| `untrack` | `value` | `@public` |
| `useApp` | `value` | `@public` |
| `watch` | `function` | `@public` |
| `WatchOptions` | `type` | `@public` |
| `WatchSource` | `type` | `@public` |
| `ZENITH_RUNTIME_CORE_VERSION` | `value` | `@public` |
