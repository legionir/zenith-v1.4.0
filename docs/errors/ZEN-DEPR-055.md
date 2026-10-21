# ZEN-DEPR-055

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-055

## علت

API قدیمی `clearComponents` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { clearComponents } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `resetForTesting() (@zenith/testing)` استفاده کنید.

```ts
resetForTesting() (@zenith/testing)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-055) = `errorDocsUrl('ZEN-DEPR-055')`
