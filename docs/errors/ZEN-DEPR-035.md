# ZEN-DEPR-035

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-035

## علت

API قدیمی `createMutation(fn, options)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { createMutation } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createMutation({ fn, ...options })` استفاده کنید.

```ts
createMutation({ fn, ...options })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-035) = `errorDocsUrl('ZEN-DEPR-035')`
