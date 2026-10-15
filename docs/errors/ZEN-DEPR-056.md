# ZEN-DEPR-056

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-056

## علت

API قدیمی `clearAuth` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { clearAuth } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `resetForTesting() (@zenith/testing)` استفاده کنید.

```ts
resetForTesting() (@zenith/testing)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-056) = `errorDocsUrl('ZEN-DEPR-056')`
