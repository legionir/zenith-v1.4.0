# @zenith/language-server

هستهٔ سرور زبان (LSP) برای فریم‌ورک Zenith (ایشوی #160).

این پکیج تحلیل اسناد Zenith (دایرکتیوهای `zen-*` و سیگنال‌های `$name`) را به‌صورت مستقل از ویرایشگر فراهم می‌کند و به‌عنوان پایهٔ کلاینت نازک `vscode-extension` و افزونه‌های دیگر ویرایشگرها استفاده می‌شود.

## API

- `analyzeZenithDocument(text)`: استخراج دایرکتیوها و سیگنال‌ها با موقعیت دقیق خط/ستون.
- `createZenithServerCore()`: هستهٔ سرور در حافظه برای تست و کلاینت‌های نازک.
- `createServerLifecycle()`: پیاده‌سازی چرخهٔ حیات مینیمال LSP (Initialize/Shutdown).
