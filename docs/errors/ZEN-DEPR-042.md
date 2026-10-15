# ZEN-DEPR-042

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-042

## علت

API قدیمی `registerCache (@zenith/devtools-core)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { registerCache } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `registerDevtoolsCache` استفاده کنید.

```ts
registerDevtoolsCache
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-042) = `errorDocsUrl('ZEN-DEPR-042')`
