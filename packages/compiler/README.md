# @zenith/compiler

پیش‌کامپایلر قالب‌های Zenith (فاز ۱۲) — قالب HTML را به JavaScript بهینه تبدیل می‌کند تا در زمان اجرا walker و parse دوباره انجام نشود.

## نصب

```bash
npm install @zenith/compiler
```

## استفاده

```typescript
import { compileTemplate } from '@zenith/compiler';

const { code } = await compileTemplate('<h1 zen-text="$user.name"></h1>', {
  strict: false, // directive ناشناخته = warning و واگذاری به runtime
});
```

خروجی یک ES module است که با `@zenith/runtime` (`Zen.start`) یا `@zenith/vite-plugin` (HMR خودکار) مصرف می‌شود.

## مستندات مرتبط

- [ARCHITECTURE.md §۳ و §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
