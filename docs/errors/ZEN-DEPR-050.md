# ZEN-DEPR-050

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-050

## علت

API قدیمی `deprecate (@zenith/logger)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { deprecate } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `warnDeprecated` استفاده کنید.

```ts
warnDeprecated
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-050) = `errorDocsUrl('ZEN-DEPR-050')`
