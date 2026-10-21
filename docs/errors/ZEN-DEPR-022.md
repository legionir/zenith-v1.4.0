# ZEN-DEPR-022

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-022

## علت

API قدیمی `FormStore.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { FormStore } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `FormStore.dispose()` استفاده کنید.

```ts
FormStore.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-022) = `errorDocsUrl('ZEN-DEPR-022')`
