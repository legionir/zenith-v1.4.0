# ZEN-DEPR-006

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-006

## علت

API قدیمی `toJalali (i18n)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { toJalali } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/jalali toJalaliParts/formatJalali` استفاده کنید.

```ts
@zenith/jalali toJalaliParts/formatJalali
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-006) = `errorDocsUrl('ZEN-DEPR-006')`
