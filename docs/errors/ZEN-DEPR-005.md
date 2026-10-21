# ZEN-DEPR-005

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-005

## علت

API قدیمی `clearCache (http)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { clearCache } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `clearHttpCache` استفاده کنید.

```ts
clearHttpCache
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-005) = `errorDocsUrl('ZEN-DEPR-005')`
