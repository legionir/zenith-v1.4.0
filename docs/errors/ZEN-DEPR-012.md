# ZEN-DEPR-012

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-012

## علت

API قدیمی `jalaliMonthName (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { jalaliMonthName } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali monthName` استفاده کنید.

```ts
@zenith/jalali monthName
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-012) = `errorDocsUrl('ZEN-DEPR-012')`
