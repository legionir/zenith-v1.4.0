# ZEN-DEPR-065

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-065

## علت

API قدیمی `createSuspenseContext(timeoutMs, onSettle)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { createSuspenseContext } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createSuspenseContext({ timeoutMs, onSettle })` استفاده کنید.

```ts
createSuspenseContext({ timeoutMs, onSettle })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-065) = `errorDocsUrl('ZEN-DEPR-065')`
