# ZEN-DEPR-039

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-039

## علت

API قدیمی `animate(el, keyframes, duration, easing, delay, fill, onFinish)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { animate } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `animate(el, { keyframes, duration, easing, delay, fill, onFinish })` استفاده کنید.

```ts
animate(el, { keyframes, duration, easing, delay, fill, onFinish })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-039) = `errorDocsUrl('ZEN-DEPR-039')`
