# ZEN-DEPR-026

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-026

## علت

API قدیمی `installStatefulComponents()` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { installStatefulComponents } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `Zen.use(ZenithStatefulPlugin)` استفاده کنید.

```ts
Zen.use(ZenithStatefulPlugin)
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-026) = `errorDocsUrl('ZEN-DEPR-026')`
