# ZEN-DEPR-019

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-019

## علت

API قدیمی `ActionRegistry.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { ActionRegistry } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `ActionRegistry.dispose()` استفاده کنید.

```ts
ActionRegistry.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-019) = `errorDocsUrl('ZEN-DEPR-019')`
