# ZEN-DEPR-066

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-066

## علت

API قدیمی `processFetchWithCache(url, ttl)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { processFetchWithCache } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `processFetchWithCache(url, { ttl })` استفاده کنید.

```ts
processFetchWithCache(url, { ttl })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-066) = `errorDocsUrl('ZEN-DEPR-066')`
