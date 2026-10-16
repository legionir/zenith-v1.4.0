# ZEN-DEPR-008

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-008

## علت

API قدیمی `parseJalaliParts (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { parseJalaliParts } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali toJalaliParts` استفاده کنید.

```ts
@zenith/jalali toJalaliParts
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-008) = `errorDocsUrl('ZEN-DEPR-008')`
