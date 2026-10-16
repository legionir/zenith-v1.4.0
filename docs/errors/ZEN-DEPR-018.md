# ZEN-DEPR-018

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-018

## علت

API قدیمی `fromJsonSchema (form)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { fromJsonSchema } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/schema/json-schema fromJsonSchema` استفاده کنید.

```ts
@zenith/schema/json-schema fromJsonSchema
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-018) = `errorDocsUrl('ZEN-DEPR-018')`
