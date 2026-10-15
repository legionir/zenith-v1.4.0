# ZEN-DEPR-017

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-017

## علت

API قدیمی `validateWithZod (form)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { validateWithZod } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/schema/zod validateWithZod` استفاده کنید.

```ts
@zenith/schema/zod validateWithZod
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-017) = `errorDocsUrl('ZEN-DEPR-017')`
