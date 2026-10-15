# ZEN-DEPR-053

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-053

## علت

API قدیمی `confirm (@zenith/notifications)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { confirm } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `showConfirm` استفاده کنید.

```ts
showConfirm
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-053) = `errorDocsUrl('ZEN-DEPR-053')`
