# ZEN-DEPR-032

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-032

## علت

API قدیمی `onStateChange (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { onStateChange } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core onStateChange` استفاده کنید.

```ts
@zenith/devtools-core onStateChange
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-032) = `errorDocsUrl('ZEN-DEPR-032')`
