# ZEN-DEPR-038

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-038

## علت

API قدیمی `withTimeout(promise, ms, message)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { withTimeout } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `withTimeout(promise, { ms, message })` استفاده کنید.

```ts
withTimeout(promise, { ms, message })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-038) = `errorDocsUrl('ZEN-DEPR-038')`
