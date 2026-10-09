# Zenith v1.4.0 — گزارش عمیق‌تر باگ‌ها

## Compiler (BUG-COMP-01..08)
- Silent directive drop در production (zen-track, zen-date-picker و غیره)
- Structural directive conflict detection ناقص تا v1.3.0
- zen-for: نشت حافظه‌ی child effects در v0.3.0 (رفع شده با dispose)
- zen-model: دو-way binding با getter-only ctx.$field → شکست در strict mode
- zen-bind: object syntax برای expression پیچیده کار نمی‌کرد
- zen-key: فقط simple `item.field` پشتیبانی می‌شد
- Fallback برای directive ناشناخته بدون warning دقیق بود (BUG-COMP-08)
- sanitizeHTML در zen-html برای XSS نیاز به پارامتر render() داشت (رفع شده)

## Auth (BUG-12, BUG-AUT-01..04)
- refresh race با چندین caller → `_refreshPromise` guard اضافه شد
- `_destroyed` بدون بررسی در `_scheduleRefresh` اولیه
- fetchUser در constructor بدون await → race با logout
- cookie بدون `max-age` و `expires` در `_storeTokens`
- auto-refresh برای آفلاین بدون event listener صحیح (رفع شده)

## Runtime / Scheduler / Security
- runtime: hydrate race با DOM قدیمی
- scheduler: priority بدون limit → memory leak
- security: sanitizer regex ناقص → XSS bypass احتمالی
- service-worker: strategy بدون fallback در آفلاین
- ssr: render بدون stream flush → performance

## داده‌های اضافی از grep
- actions: `_validateName` regex `[a-zA-Z0-9_$.\-]` برای namespace `. ` و `-` مجاز است اما `.` در انتها با regex قبول نمی‌شود (تضاد)
- cli: BUG-CLI-04 (package manager detection) و BUG-CLI-05 (Unicode normalization)
- components: async-loader بدون timeout
- crud: fetch loop نامحدود
- errors, events, expressions, form, i18n, permission, resource, router, state, stateful, store, suspense, transition, virtual-list: همان موارد قبلی
