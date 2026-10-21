# ZEN-DEPR-007

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-007

## علت

API قدیمی `fromJalali (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { fromJalali } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali fromJalaliParts` استفاده کنید.

```ts
@zenith/jalali fromJalaliParts
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-007) = `errorDocsUrl('ZEN-DEPR-007')`
