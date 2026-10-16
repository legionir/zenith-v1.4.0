# ZEN-DEPR-028

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-028

## علت

API قدیمی `recordStateChange (@zenith/state)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { recordStateChange } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `@zenith/devtools-core recordStateChange / installDevtoolsCore` استفاده کنید.

```ts
@zenith/devtools-core recordStateChange / installDevtoolsCore
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-028) = `errorDocsUrl('ZEN-DEPR-028')`
