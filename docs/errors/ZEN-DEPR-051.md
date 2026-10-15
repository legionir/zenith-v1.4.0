# ZEN-DEPR-051

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-051

## علت

API قدیمی `mockHttp (@zenith/testing)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { mockHttp } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `mockFetch` استفاده کنید.

```ts
mockFetch
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-051) = `errorDocsUrl('ZEN-DEPR-051')`
