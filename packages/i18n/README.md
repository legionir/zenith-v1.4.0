# @zenith/i18n

ابزار بین‌المللی‌سازی پایه (لایهٔ L0) — ارقام فارسی/عربی، تقویم جلالی، و قالب عدد/قیمت. بدون وابستگی به DOM یا signal.

## نصب

```bash
npm install @zenith/i18n
```

## استفاده

```typescript
import { toPersianNums, toJalali, jalaliNow } from '@zenith/i18n';

toPersianNums('1234'); // '۱۲۳۴'
toJalali(new Date(2026, 6, 30)); // { year: 1405, month: 4, day: 8 }
```

> بازنویسی کامل i18n (پیام‌ها، ICU، plural، signal واکنشی) در `@zenith/i18n` نسل بعد برنامه‌ریزی شده است (issue #150)؛ رفتار تقویم خارج از بازهٔ پشتیبانی‌شده به‌جای هشدار، تعریف‌شده خواهد شد (issue #101).

## مستندات مرتبط

- [ARCHITECTURE.md §۲](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
