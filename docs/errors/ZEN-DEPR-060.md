# ZEN-DEPR-060

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-060

## علت

API قدیمی `clearServerComponents` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { clearServerComponents } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `resetForTesting() (@zenith/testing)` استفاده کنید.

```ts
resetForTesting() (@zenith/testing)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-060) = `errorDocsUrl('ZEN-DEPR-060')`
