=== یافته‌های جدید از اسکن دقیق .ts ===

1. packages/expressions/src/parser.ts:329,460,497 -> while(true) با break درون شرط (ریسک infinite loop اگر شرط هرگز false نشود)
2. packages/expressions/src/validator.ts -> setInterval بدون clearInterval
3. packages/cli/src/templates.ts -> addEventListener (15 بار) > removeEventListener (0 بار)
4. packages/compiler/src/compiler.ts -> addEventListener > removeEventListener (1)
5. packages/devtools/src/hook.ts -> addEventListener > removeEventListener (2)
6. packages/service-worker/src/sw.ts -> addEventListener > removeEventListener (6)
7. packages/vite-plugin/src/compile.ts -> addEventListener > removeEventListener (2)
8. packages/runtime/src/directives/date-picker.ts -> addEventListener > removeEventListener (3)
9. packages/vscode-extension/src/extension.ts -> addEventListener > removeEventListener (1)

=== تحلیل عمیق‌تر ===
- حلقه‌های parser: اگر input به‌درستی خاتمه نیابد (مثلاً EOF ناگهانی)، while(true) بدون guard خارجی می‌تواند برای همیشه اجرا شود.
- validator: setInterval بدون clearInterval باعث می‌شود تایمر تا پایان عمر فرآیند فعال بماند.
- listener leaks: هر بار که عنصر جدیدی ساخته می‌شود و listener اضافه می‌شود اما remove نمی‌شود، با هر تعامل کاربر تعداد listenerها افزایش می‌یابد و عملکرد کند می‌شود.
✅ expressions/src/parser.ts اصلاح شد
✅ ACTION_PLAN.md به‌روزرسانی شد (۸ مورد انجام شده)
✅ باقی‌مانده: ۵ listener + تست
