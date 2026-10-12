# @zenith/storage

L0 — لایهٔ واحد ذخیره‌سازی همه‌جا (مرورگر و سرور). SPEC §۲.۵؛ #145.

## چرا؟

`auth` (توکن)، `store` (persist) و دموها هرکدام `localStorage` را دستی
می‌زدند. این پکیج یک API واحد با درایور، TTL، نسخه‌بندی/مهاجرت،
همگام‌سازی بین‌تب، حالت حساس و مدیریت quota می‌دهد.

```ts
import { createStorage, signal } from '@zenith/storage';

const store = createStorage({ namespace: 'cart', version: 2, migrate: (old, from) =>
  from < 2 ? { items: old, updatedAt: 0 } : old });

await store.ready;             // فقط برای indexeddb معنادار است
store.set('items', [1, 2, 3], { ttl: 30_000 });
store.get('items');            // ⇒ [1, 2, 3]
```

## API

| export | توضیح |
|---|---|
| `createStorage(opts?)` | نمونهٔ `ZenithStorage & Disposable` |
| `storage.get/set/has/keys/remove/clear` | CRUD همگام |
| `storage.subscribe(key, cb) → Cleanup` | تغییر (local/tab/remove) |
| `storage.signal(key, initial)` | سیگنال ساختاری `Readable<T>` |
| `signal(key, initial, o?)` | همان، روی نمونهٔ پیش‌فرض (`@zenith/storage/signal`) |
| `persistStore(store, opts) → Cleanup` | persist خودکار یک store (debounce/hydrate) |
| `parsePersistAttr` | گرامر attributeهای `zen-persist` |
| `memoryDriver/localDriver/sessionDriver/cookieDriver/indexedDBDriver` | درایورها |
| `isStorageAvailable(driver)` | سنجش بدون throw |
| `DEFAULTS` | پیش‌فرض‌های فریزشده |

## گزینه‌ها (`StorageOptions`)

`driver` (پیش‌فرض مرورگر `local` / سرور `memory`)، `namespace` (`'zen'`)،
`version` (`1`)، `migrate`، `serializer` (JSON)، `ttl` (`'never'`)،
`sync` (`true`)، `sensitive` (`false`)، `onQuotaExceeded`
(`'evict-oldest'`)، `cookie` (`{ path:'/', sameSite:'Strict', secure:true }`).

## امنیت

- `sensitive: true` نوشتن در `local/session/indexeddb` را ممنوع می‌کند و
  به `memory` برمی‌گردد (ZEN-1101). برای توکن‌ها همین را تنظیم کنید، مگر
  عمداً (مثل remember-me در `auth`) localStorage بخواهید که ریسکش در
  `packages/auth` مستند است.
- کوکی سمت کلاینت نمی‌تواند HttpOnly باشد؛ برای sessions از کوکی
  HttpOnly سمت سرور استفاده کنید (`docs/security/auth.md`).
- دادهٔ بازخوانی‌شده با `validate` (schema اختیاری) بررسی می‌شود تا دادهٔ
  دست‌کاری‌شده پذیرفته نشود.

## خطاها

`ZEN-1101` ذخیره‌گاه در دسترس نیست (fallback memory)، `ZEN-1102` quota،
`ZEN-1103` شکست migrate، `ZEN-1104` دادهٔ خراب. ttl نامعتبر ⇒ `ZEN-1201`.

## attribute

پیاده‌سازی دایرکتیو `zen-persist` در `@zenith/runtime` است
(`directives/persist.ts`؛ DEC-030 گزینهٔ I — storage خود DOM نمی‌شناسد):

```html
<input zen-model="$cart.note" zen-persist="cart.note"
       zen-persist-driver="local" zen-persist-ttl="never"
       zen-persist-version="1" zen-persist-debounce="300ms" />
```
