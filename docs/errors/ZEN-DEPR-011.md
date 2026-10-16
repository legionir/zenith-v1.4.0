# ZEN-DEPR-011

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-011

## علت

API قدیمی `jalaliMonthDays (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { jalaliMonthDays } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali monthDays` استفاده کنید.

```ts
@zenith/jalali monthDays
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-011) = `errorDocsUrl('ZEN-DEPR-011')`
