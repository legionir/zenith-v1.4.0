# ZEN-DEPR-040

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-040

## علت

API قدیمی `animateEnter(el, name, duration, easing, onFinish)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { animateEnter } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `animateEnter(el, { name, duration, easing, onFinish })` استفاده کنید.

```ts
animateEnter(el, { name, duration, easing, onFinish })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-040) = `errorDocsUrl('ZEN-DEPR-040')`
