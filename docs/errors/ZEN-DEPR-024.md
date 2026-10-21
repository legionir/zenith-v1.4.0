# ZEN-DEPR-024

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-024

## علت

API قدیمی `SWController.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { SWController } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `SWController.dispose()` استفاده کنید.

```ts
SWController.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-024) = `errorDocsUrl('ZEN-DEPR-024')`
