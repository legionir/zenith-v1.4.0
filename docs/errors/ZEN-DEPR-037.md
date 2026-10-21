# ZEN-DEPR-037

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-037

## علت

API قدیمی `trackPromise(promise, suspense, key, timeout)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { trackPromise } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `trackPromise(promise, { suspense, key, timeout })` استفاده کنید.

```ts
trackPromise(promise, { suspense, key, timeout })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-037) = `errorDocsUrl('ZEN-DEPR-037')`
