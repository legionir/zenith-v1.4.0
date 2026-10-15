# ZEN-DEPR-044

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-044

## علت

API قدیمی `registerSignal (@zenith/devtools)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { registerSignal } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `registerPanelSignal` استفاده کنید.

```ts
registerPanelSignal
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-044) = `errorDocsUrl('ZEN-DEPR-044')`
