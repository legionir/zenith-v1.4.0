# ZEN-DEPR-036

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-036

## علت

API قدیمی `createInfiniteQuery(key, fn, options)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { createInfiniteQuery } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createInfiniteQuery({ key, fn, ...options })` استفاده کنید.

```ts
createInfiniteQuery({ key, fn, ...options })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-036) = `errorDocsUrl('ZEN-DEPR-036')`
