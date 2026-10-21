# ZEN-DEPR-021

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-021

## علت

API قدیمی `CrudEngine.destroy()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { CrudEngine } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `CrudEngine.dispose()` استفاده کنید.

```ts
CrudEngine.dispose()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-021) = `errorDocsUrl('ZEN-DEPR-021')`
