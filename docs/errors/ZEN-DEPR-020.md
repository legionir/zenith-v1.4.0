# ZEN-DEPR-020

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-020

## علت

API قدیمی `Auth.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { Auth } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `Auth.dispose()` استفاده کنید.

```ts
Auth.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-020) = `errorDocsUrl('ZEN-DEPR-020')`
