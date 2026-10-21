# ZEN-DEPR-031

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-031

## علت

API قدیمی `getStateTimeline (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { getStateTimeline } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core getTimeline` استفاده کنید.

```ts
@zenith/devtools-core getTimeline
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-031) = `errorDocsUrl('ZEN-DEPR-031')`
