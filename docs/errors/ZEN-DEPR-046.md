# ZEN-DEPR-046

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-046

## علت

API قدیمی `invalidate (@zenith/data)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { invalidate } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `invalidateFetchCache` استفاده کنید.

```ts
invalidateFetchCache
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-046) = `errorDocsUrl('ZEN-DEPR-046')`
