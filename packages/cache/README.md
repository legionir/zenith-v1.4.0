# @zenith/cache — L0 shared cache

کش مرکزی Zenith (SPEC §۲.۴): TTL، انقضای lazy (بدون timer ⇒ SSR-safe)،
LRU/FIFO، بودجهٔ بایت (`maxBytes` + `sizeOf`)، برچسب‌ها (`tags`) با
`invalidate`، `getOrLoad` با dedupe برای درخواست همزمان، `staleWhileRevalidate`،
آمار (`stats`)، رجیستری devtools (`listCaches`) و `signal(key)` از طریق
`setSignalAdapter`. جایگاه: تنها پیاده‌سازی cache کل ورک‌اسپیس — شش
پیاده‌سازی مستقل (http/data/resource/components/expressions/router) به این
پکیج مهاجرت کردند. **وابستگی فقط `errors` + `shared`، صفر اثر جانبی،
isomorphic، بودجه ≤ ۳KB gzip.**

> پکیج جدید موج ۲ (#144). نسخهٔ تولد `1.5.0` و ESM-only طبق DEC-026/DEC-027.

## نصب

```bash
npm install @zenith/cache
```

## API

| export | امضا | توضیح |
| --- | --- | --- |
| `createCache` | `(opts?: CacheOptions<V,K>) => Cache<V,K> & Disposable` | نمونهٔ مستقل؛ `name` ⇒ auto-register |
| `parseCacheAttr` | `(value: string) => CachePolicy` | رشتهٔ DTA `ttl` ⇒ `{ttl, staleWhileRevalidate?, tags?, disabled?}` |
| `registerCache` | `(name, cache) => Cleanup` | ثبت دستی برای devtools؛ نام تکراری ⇒ `ZEN-1090` |
| `unregisterCache` | `(name) => void` | حذف رکورد رجیستری |
| `listCaches` | `() => Array<{ name; stats }>` | آمار لحظه‌ای کش‌های ثبت‌شده (devtools) |
| `setSignalAdapter` | `(adapter: (key, cache) => Readable) => Cleanup` | تزریق سازندهٔ `Readable` برای `signal` (DEC-021) |

رابط `Cache`: `get`/`peek` (بدون لمس تازگی/آمار)/`set(key,v,{ttl,tags}) → V`/
`has`/`delete → boolean`/`clear`/`invalidate(tagsOrPredicate) → K[]`/
`getOrLoad(key, loader, opts?) → Promise<V>`/`revalidate(key, value) → boolean`/
`isStale(key) → boolean`/`keys() → K[]`/`stats()`/`onEvict(cb) → Cleanup`/
`signal(key) → Readable`/`size`/`name`.

گزینه‌های `createCache`: `ttl` (`'never'`؛ `0` ⇒ بدون انقضا طبق ZEN-1201)،
`staleWhileRevalidate` (`0`)، `maxSize` (`500`)، `maxBytes` + `sizeOf`،
`policy` (`'lru' | 'fifo'`)، `clock` (`Date.now`)، `name` (auto-register)،
`onEvict`.

`stats`: `{ size, maxSize, hits, misses, staleHits, evictions, hitRatio,
pending, tagKeys, bytes? }` — `bytes` فقط با `sizeOf`. شکل پایه با
`expressions.getCacheStats` سازگار نگه داشته شد (فیلدهای افزوده اختیاری‌اند).

## مثال

```ts
import { createCache } from '@zenith/cache';

const cache = createCache<string>({ ttl: 30_000, maxSize: 100, name: 'posts' });

cache.set('k1', 'v1', { tags: ['posts'] });
await cache.getOrLoad('k2', async () => fetchPost('k2')); // یک loader برای N فراخوان همزمان

cache.invalidate('posts');          // ⇒ کلیدهای حذف‌شده
cache.stats().hitRatio;             // آمار
cache.dispose();                    // free + auto-unregister (قرارداد §۰.۱)
```

`parseCacheAttr` ورودی‌های DTA را می‌گیرد: `"30s"`، `"30s,swr=2m"`، `"never"`،
`"false"` (⇒ `disabled`)، عدد خام ⇒ ms، و دنبالهٔ برچسب (`tag=users,v2`).
ورودی بی‌معنا ⇒ `{ ttl: NaN }` (قضاوت به فراخوان واگذار).

## رفتارهای تضمین‌شده با تست

- انقضای lazy: هیچ `setTimeout`/`setInterval` در src (acceptance SSR).
- `getOrLoad` برای یک کلید در حال بارگذاری ⇒ دقیقاً یک `loader` (۱۰۰ فراخوان
  همزمان ⇒ ۱ فراخوانی؛ معیار پذیرش #144).
- `staleWhileRevalidate` ⇒ مقدار stale فوراً سرو می‌شود و بارگذاری پس‌زمینه
  dedupe و خطایش فروخورده (`catch`) است.
- محافظت از commit دیرهنگام: `delete`/`invalidate`/`clear`/`set` حین load
  در-flight ⇒ commit پایانی با ژن‌شمارنده (`bumps`) نادیده گرفته می‌شود
  (جلوگیری از «ghost» و نشت حافظه).
- `peek` تازگی و آمار را تغییر نمی‌دهد؛ `get` لمس LRU می‌کند (FIFO نمی‌کند).
- بعد از `dispose` هر عملیات ⇒ `ZEN-1090` (invariant).
- `signal` بدون adapter ⇒ `ZEN-1090` با پیام حاوی «adapter».

## مهاجرت مصرف‌کننده‌ها

شش پیاده‌سازی مستقل حذف شد و روی `@zenith/cache` نشست؛ API عمومی هر پکیج
حفظ شد (نام جدید + `deprecate()` برای alias قدیمی، طبق قاعدهٔ no-breaking):

| پکیج | نماد قدیمی | نگاشت |
| --- | --- | --- |
| expressions | `cache`/`getCacheStats`/`clearCache` | `createCache` + `stats` هم‌شکل |
| http | `cacheStore`/`clearCache(tags)` | `getOrLoad`/`invalidate` (نام جدید + deprecate) |
| data | `getCachedData`/`setCachedData`/`clearFetchCache` | wrapper روی `get`/`set`/`invalidate` |
| resource | `_inflightRequests`/`staleTime` | `getOrLoad` + ttl=staleTime |
| components | `cache`/`errorCache` (30s) | دو `createCache` با ttl |
| router | `routeCache` (LRU) | `createCache({policy:'lru'})`؛ رفع BUG-RTR-04 |

## توسعه

```bash
npm run build -w @zenith/cache    # tsc → dist/ (ESM-only)
npx vitest run packages/cache     # unit + getOrLoad + limits + layering + size
```

## طرح‌های تصمیم مرتبط

- DEC-026/DEC-027 — نسخهٔ `1.5.0`، ESM-only، engines ≥ 18.19
- DEC-020/#171 — `ZEN-1201` (ttl نامعتبر)/`ZEN-1202` (شکست loader) از catalog
- DEC-021/#141 — الگوی لایه: `cache.signal` بدون یال به state (adapter تزریقی)
- DEC-022 — سازگاری SSR؛ cache بخشی از زیرساخت per-app (سیگنال adapter ممکن
  است در #92 وصل شود).
