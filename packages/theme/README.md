# @zenith/theme

مدیر تم واکنشی Zenith (ایشوی `#161` — لایهٔ L2).

## API

| نماد | توضیح |
|---|---|
| `createTheme(opts)` | ساخت مدیر تم با سیگنال‌های `mode`، `resolved`، `dir`؛ متدهای `setMode`، `toggle`، `tokens(name)`، `dispose` |
| `themeInitScript({nonce, storageKey, attribute, cookie, defaultMode})` | اسکریپت inline `<head>` برای اعمال تم پیش از اولین رنگ (بدون flash) |
| `themePlugin(options)` | پلاگین رسمی `app.use(...)` (provide با کلید `zenith:theme`) |

## دایرکتیوها

| attribute | رفتار |
|---|---|
| `zen-theme-toggle` | کلیک ⇒ toggle؛ `aria-pressed` خودکار |
| `zen-theme-mode="light|dark|system"` | کلیک ⇒ setMode؛ کلاس `zen-theme-active` + `aria-checked` |
| `zen-dir="ltr|rtl|auto"` | لغو جهت جهت subtree |

## SSR / بدون flash

```js
import { themeInitScript } from '@zenith/theme';
const head = themeInitScript({ nonce: cspNonce, cookie: true });
```

تم از cookie یا localStorage خوانده شده و `data-theme`/`class` قبل از رنگ اولیه روی `<html>` اعمال می‌شود. رویداد `storage` تب‌ها را همگام نگه می‌دارد.

## خطاها

- `ZEN-2001` token تم نامعتبر
- `ZEN-2002` ذخیره‌گاه تم در دسترس نیست
