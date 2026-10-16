# ZEN-DEPR-014

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-014

## علت

API قدیمی `compareJalali (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { compareJalali } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali compareJalali` استفاده کنید.

```ts
@zenith/jalali compareJalali
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-014) = `errorDocsUrl('ZEN-DEPR-014')`
