# ZEN-DEPR-027

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-027

## علت

API قدیمی `registerSignal (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { registerSignal } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core registerSignal / installDevtoolsCore` استفاده کنید.

```ts
@zenith/devtools-core registerSignal / installDevtoolsCore
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-027) = `errorDocsUrl('ZEN-DEPR-027')`
