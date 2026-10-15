# ZEN-DEPR-002

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-002

## علت

API قدیمی `enterTransition` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { enterTransition } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createTransition(name).enter(el)` استفاده کنید.

```ts
createTransition(name).enter(el)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-002) = `errorDocsUrl('ZEN-DEPR-002')`
