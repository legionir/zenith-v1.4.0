# ZEN-DEPR-003

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-003

## علت

API قدیمی `leaveTransition` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { leaveTransition } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createTransition(name).leave(el)` استفاده کنید.

```ts
createTransition(name).leave(el)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-003) = `errorDocsUrl('ZEN-DEPR-003')`
