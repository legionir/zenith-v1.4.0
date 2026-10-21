# ZEN-DEPR-033

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-033

## علت

API قدیمی `nameSignal (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { nameSignal } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core nameSignal` استفاده کنید.

```ts
@zenith/devtools-core nameSignal
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-033) = `errorDocsUrl('ZEN-DEPR-033')`
