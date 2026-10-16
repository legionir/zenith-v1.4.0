# ZEN-DEPR-052

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-052

## علت

API قدیمی `alert (@zenith/notifications)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { alert } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `showAlert` استفاده کنید.

```ts
showAlert
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-052) = `errorDocsUrl('ZEN-DEPR-052')`
