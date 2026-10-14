# @zenith/feature-flags

پرچم‌های ویژگی واکنشی (ایشوی `#168` — لایهٔ L2).

## API

| نماد | توضیح |
|---|---|
| `createFlags(options)` | ساخت مدیر flag با `flag(name, def)`، `variant(name)` (هر دو ReadonlySignal)، `setContext`، `override(name, value) → Cleanup`، `refresh()`، `dispose()` |
| `stableHashRollout(name, userId)` | rollout پایدار FNV-1a (۰..۹۹)؛ برای یک userId ثابت همیشه نتیجهٔ یکسان |
| `flagsPlugin(options)` | پلاگین رسمی `app.use(...)` (provide با کلید `zenith:flags`) |

## دایرکتیوها

| attribute | رفتار |
|---|---|
| `zen-flag="name"` | نمایش/پنهان بر اساس flag | 
| `zen-flag-else` | template fallback وقتی flag خاموش است |
| `zen-flag-variant="name:val"` | نمایش وقتی variant مساوی val است |
| `zen-flag-default="true|false"` | مقدار پیش‌فرض برای flag تعریف‌نشده |

## SSR bootstrap

`bootstrap` در options دادهٔ first-paint را نگه می‌دارد تا بدون flicker رندر شود. `persist:true` روی localStorage کش می‌کند و refresh رویدادی flagها را به‌روز می‌کند.

## خطاها

- `ZEN-2201` پرچم تعریف‌نشده (dev)  
- `ZEN-2202` بارگذاری source شکست
