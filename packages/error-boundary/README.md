# @zenith/error-boundary

مرز خطا و هندلر سراسری (فاز ۱۱) — خطاهای زمان اجرا را در directiveها و expressionها می‌گیرد، UI جانشین (fallback) نشان می‌دهد و اجازهٔ recovery می‌دهد.

## نصب

```bash
npm install @zenith/error-boundary
```

## استفاده

```html
<div zen-error-boundary>
  <Comp />
  <template zen-fallback="err">
    <p>مشکل پیش آمد: {{ err.message }}</p>
    <button zen-action="recover">تلاش دوباره</button>
  </template>
</div>
```

```typescript
import { showFallback, recoverFromError } from '@zenith/error-boundary';
```

> #115 (DEC-031): مدل خطا یکپارچه شد — این پکیج دیگر listener/history موازی ندارد.
> `onError`/`reportError`/`errorSignal`/`clearError` wrapper روی hub واحد در
> `@zenith/errors` هستند و `ZenithError` همان کلاس `@zenith/errors` است.

## مستندات مرتبط

- [docs/api/error-management.md](../../docs/api/error-management.md)
- [README ریشه](../../README.md)

## مجوز

MIT
