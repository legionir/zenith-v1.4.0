# ZEN-DEPR-041

> هشدار deprecation • حذف در نسخهٔ **2.0.0** (DEC-026) • لینک آنلاین: https://zenith.dev/errors/ZEN-DEPR-041

## علت

API قدیمی `animateLeave(el, name, duration, easing, onFinish)` فراخوانی شده است. این نام در نسخهٔ 2.0.0 حذف می‌شود.

## نمونهٔ کد خطادار

```ts
import { animateLeave } from '@zenith/…'; // ❌ منسوخ
```

## رفع

از `animateLeave(el, { name, duration, easing, onFinish })` استفاده کنید.

```ts
animateLeave(el, { name, duration, easing, onFinish })
```

---

[فهرست کدها](./README.md) • [docsUrl](https://zenith.dev/errors/ZEN-DEPR-041) = `errorDocsUrl('ZEN-DEPR-041')`
