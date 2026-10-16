# ZEN-DEPR-043

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-043

## علت

API قدیمی `registerStore (@zenith/devtools-core)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { registerStore } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `registerDevtoolsStore` استفاده کنید.

```ts
registerDevtoolsStore
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-043) = `errorDocsUrl('ZEN-DEPR-043')`
