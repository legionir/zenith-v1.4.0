# ZEN-DEPR-025

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-025

## علت

API قدیمی `schedule() (@zenith/scheduler)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { schedule } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `scheduleEffect()` استفاده کنید.

```ts
scheduleEffect()
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-025) = `errorDocsUrl('ZEN-DEPR-025')`
