# ZEN-DEPR-045

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-045

## علت

API قدیمی `recordStateChange (@zenith/devtools)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { recordStateChange } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `recordPanelStateChange` استفاده کنید.

```ts
recordPanelStateChange
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-045) = `errorDocsUrl('ZEN-DEPR-045')`
