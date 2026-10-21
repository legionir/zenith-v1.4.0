# ZEN-DEPR-029

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-029

## علت

API قدیمی `getAllSignals (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { getAllSignals } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core getAllSignals` استفاده کنید.

```ts
@zenith/devtools-core getAllSignals
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-029) = `errorDocsUrl('ZEN-DEPR-029')`
