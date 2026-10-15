# ZEN-DEPR-004

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-004

## علت

API قدیمی `animateGroup` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { animateGroup } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createTransition(name) shared controller` استفاده کنید.

```ts
createTransition(name) shared controller
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-004) = `errorDocsUrl('ZEN-DEPR-004')`
