# ZEN-DEPR-001

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-001

## علت

API قدیمی `processVirtualList` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { processVirtualList } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `createVirtualList` استفاده کنید.

```ts
createVirtualList
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-001) = `errorDocsUrl('ZEN-DEPR-001')`
