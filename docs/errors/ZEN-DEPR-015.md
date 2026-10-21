# ZEN-DEPR-015

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-015

## علت

API قدیمی `addDaysJalali (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { addDaysJalali } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali addDays` استفاده کنید.

```ts
@zenith/jalali addDays
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-015) = `errorDocsUrl('ZEN-DEPR-015')`
