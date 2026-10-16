# ZEN-DEPR-009

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-009

## علت

API قدیمی `formatJalali (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { formatJalali } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali formatJalali` استفاده کنید.

```ts
@zenith/jalali formatJalali
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-009) = `errorDocsUrl('ZEN-DEPR-009')`
