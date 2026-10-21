# ZEN-DEPR-016

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-016

## علت

API قدیمی `fromZod (form)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { fromZod } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/schema/zod fromZod` استفاده کنید.

```ts
@zenith/schema/zod fromZod
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-016) = `errorDocsUrl('ZEN-DEPR-016')`
