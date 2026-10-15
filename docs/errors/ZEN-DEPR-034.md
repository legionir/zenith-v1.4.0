# ZEN-DEPR-034

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-034

## علت

API قدیمی `clearRegistry (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { clearRegistry } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core clearRegistry` استفاده کنید.

```ts
@zenith/devtools-core clearRegistry
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-034) = `errorDocsUrl('ZEN-DEPR-034')`
