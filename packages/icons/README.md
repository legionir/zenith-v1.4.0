# @zenith/icons

رجیستری آیکن SVG با sanitize امن (ایشوی `#170` — لایهٔ L2).

## API

| نماد | توضیح |
|---|---|
| `registerIcons(set, {prefix, registry}) → Cleanup` | ثبت مجموعهٔ آیکن با Cleanup |
| `getIcon(name, registry?)` / `hasIcon` / `listIcons` / `unregisterIcon` | قرارداد رجیستری ۵ متدی |
| `renderIcon(name, {size,label,set,spin})` | رندر رشتهٔ SVG سالم |
| `sanitizeIconBody(body)` | پاک‌سازی script/on*/foreignObject |
| `BASIC_ICONS` | مجموعهٔ پایه (menu/close/check/chevron-down/search) |

## دایرکتیو

| attribute | رفتار |
|---|---|
| `zen-icon="name"` | رندر آیکن داخل عنصر؛ `zen-icon-size` (پیش‌فرض 1em)، `zen-icon-label`، `zen-icon-set`، `zen-icon-spin` |

بدون label ⇒ `aria-hidden="true"`؛ با label ⇒ `role="img"` + `aria-label`.

## امنیت

بدنهٔ آیکن ابتدا با `@zenith/security.sanitizeHTML` پاک می‌شود و سپس تگ‌های `script`/`foreignObject` و صفت‌های `on*` حذف می‌شوند.
