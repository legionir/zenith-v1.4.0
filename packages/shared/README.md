# @zenith/shared — L0 shared types & pure utilities

نوع‌ها و ابزارهای مشترکی که در پکیج‌های Zenith تکرار شده بودند: قرارداد
آزادسازی (`Disposable`/`Cleanup`)، واکنش‌گری ساختاری (`Readable`/`MaybeReactive`/
`toValue`)، ادغام امن گزینه‌ها، پارسرهای attribute، تشخیص محیط و سازنده‌های
شناسه. **صفر اثر جانبی، isomorphic، وابستگی فقط `@zenith/errors`** — بودجهٔ
حجم ≤ ۲KB gzip (با `@zenith/*` external).

> پکیج جدید موج ۲ (#141، SPEC §۲.۱). نسخهٔ تولد `1.5.0` و ESM-only طبق
> DEC-026/DEC-027. `Readable` ساختاری است تا چرخهٔ `shared ↔ state` ساخته
> نشود (DEC-021؛ تست نوع: `test/types.test-d.ts`).

## نصب

```bash
npm install @zenith/shared
```

## API

| export | امضا | توضیح |
| --- | --- | --- |
| `Disposable` | `interface { dispose(): void }` | قرارداد آزادسازی (§۰.۱) |
| `Cleanup` | `() => void` | خروجی `registerX`/`onX`/`bindX` |
| `Readable<T>` | `interface { get(): T }` | ساختاری؛ Signal/Computed آن را برآورده می‌کنند |
| `MaybeReactive<T>` | `T \| Readable<T>` | `state` نام `MaybeSignal` را re-export می‌کند |
| `toValue` | `(v: MaybeReactive<T>) => T` | خواندن مقدار |
| `isReadable` | `(v: unknown) => v is Readable<unknown>` | گارد نوع/مقدار |
| `createDisposer` | `() => Disposable & { add(c); run() }` | جمع‌کنندهٔ LIFO + idempotent |
| `defineDefaults` | `<T>(d: T) => Readonly<T>` | فریز عمیق `DEFAULTS` |
| `mergeOptions` | `<T>(defaults, user?) => T` | ادغام امن (بدون `__proto__`) |
| `parseDuration` | `(v: string \| number) => number \| 'never'` | `"30s"` ⇒ `30000`؛ نامعتبر ⇒ `NaN` |
| `parseBooleanAttr` | `(v: string \| null, def) => boolean` | قاعدهٔ §۰.۳ |
| `parseNumberAttr` | `(v: string \| null, def) => number` | قاعدهٔ §۰.۳ |
| `isServer` / `hasDOM` / `hasWindow` | `() => boolean` | تشخیص محیط، یک منبع |
| `createId` | `(prefix?) => string` | id غیرامنیتی، قطعی در SSR |
| `resetIdCounter` | `() => void` | شروع شمارنده برای هر درخواست SSR |
| `secureId` | `(bytes?) => string` | CSPRNG (`crypto.getRandomValues`)، #64 |
| `invariant` | `(cond, message, opts?) => asserts cond` | خطای ZEN-1090 ساختارمند |
| `ZenithGlobals` | `interface` | رجیستری کلیدهای `__ZENITH_*` (declaration merging) |

## مثال

```ts
import {
  createDisposer,
  defineDefaults,
  mergeOptions,
  parseDuration,
  toValue,
  invariant,
} from '@zenith/shared';

const DEFAULTS = defineDefaults({ delay: 300, lazy: false });

function createWidget(user?: { delay?: number | string; lazy?: boolean }) {
  // mergeOptions در برابر آلودگی prototype (‏__proto__) ایمن است:
  const opts = mergeOptions(DEFAULTS, user);
  // parseDuration: "1.5s" ⇒ 1500، عدد ⇒ ms، "never" ⇒ 'never'، نامعتبر ⇒ NaN
  const ms = parseDuration(opts.delay);
  invariant(!Number.isNaN(ms), 'delay باید duration معتبر باشد', { details: { delay: opts.delay } });

  const d = createDisposer(); // cleanupها LIFO و یک‌بار اجرا می‌شوند
  return { opts, dispose: d.dispose };
}
```

## خطاها

`ZEN-1090` (آرگومان نامعتبر، از catalog رزورشدهٔ #171 — `createReservedError`)
و `ZEN-403` (نبود crypto در `secureId`، همان قرارداد #64). هر دو `ZenithError`
با `suggestion` فارسی و `docsUrl` هستند.

## SSR / محیط

هیچ‌یک از exportها هنگام import به `window`/`document` دست نمی‌زنند (تست:
`test/env-import.test.ts` در Node خالص). برای id یکسان سرور/کلاینت،
`resetIdCounter()` را در ابتدای هر درخواست SSR صدا بزنید.

## توسعه

```bash
npm run build -w @zenith/shared # tsc → dist/
npx vitest run packages/shared  # unit + env + layering + size + type test
```

## طرح‌های تصمیم مرتبط

- DEC-021 — `Readable` ساختاری روی برند DEC-009 + الزام تست نوع
- DEC-026/DEC-027 — نسخهٔ `1.5.0`، ESM-only، engines ≥ 18.19
- DEC-020/#171 — کد `ZEN-1090` از catalog رزورشده
