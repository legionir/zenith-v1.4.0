# ZEN-DEPR-030

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-030

## علت

API قدیمی `getSignalInfo (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { getSignalInfo } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core getSignalInfo` استفاده کنید.

```ts
@zenith/devtools-core getSignalInfo
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-030) = `errorDocsUrl('ZEN-DEPR-030')`
