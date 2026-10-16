# ZEN-DEPR-049

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-049

## علت

API قدیمی `validate (@zenith/expressions)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { validate } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `validateAst` استفاده کنید.

```ts
validateAst
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-049) = `errorDocsUrl('ZEN-DEPR-049')`
