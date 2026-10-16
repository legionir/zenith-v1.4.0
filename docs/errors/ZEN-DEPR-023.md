# ZEN-DEPR-023

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-023

## علت

API قدیمی `Resource.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { Resource } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `Resource.dispose()` استفاده کنید.

```ts
Resource.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-023) = `errorDocsUrl('ZEN-DEPR-023')`
