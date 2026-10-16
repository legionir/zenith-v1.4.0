# ZEN-DEPR-010

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-010

## علت

API قدیمی `jalaliNow (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { jalaliNow } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali jalaliNow` استفاده کنید.

```ts
@zenith/jalali jalaliNow
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-010) = `errorDocsUrl('ZEN-DEPR-010')`
