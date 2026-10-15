# ZEN-DEPR-013

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-013

## علت

API قدیمی `isJalaliLeap (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { isJalaliLeap } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali isLeap` استفاده کنید.

```ts
@zenith/jalali isLeap
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-013) = `errorDocsUrl('ZEN-DEPR-013')`
