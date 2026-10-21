# DEC-011: شمارندهٔ نسل/چرخه در createSuspense و پاک‌سازی id ردشده

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #20

## زمینه

`track()` هیچ guard چرخه‌ای نداشت: پس از `reset()` (retry) تسویهٔ پرامیس‌های
نسل قبلی `stopLoading`/`notifyReady` را صدا می‌زد و `onReady` زودهنگام —
در حالی‌که retry هنوز pending بود — فعال می‌شد. همچنین شاخهٔ reject هرگز id
را از `loadingSet` حذف نمی‌کرد؛ `reportError` سیگنال را موقتاً صفر می‌کرد اما
پس از تسویهٔ سایر پرامیس‌ها، `updateState` با شمارش id نشت‌کرده boundary را
تاکیداً در حالت loading نگه می‌داشت.

## گزینه‌ها

1. شمارندهٔ نسل (generation) snapshot شده در هر `track()` + مقایسه هنگام تسویه؛ `reset()` نسل را زیاد می‌کند.
2. مجموعهٔ idهای فعال + `AbortController`-مانند per-promise cancellation — پیچیده‌تر، همان نتیجه.
3. حذف effect و کوئری مستقیم — تغییر ساختار بدون نیاز.

## تصمیم و دلیل

گزینهٔ ۱ (ساده‌ترین API، استاندارد «epoch guard» در react-query/SWR).
در شاخهٔ reject: ابتدا `stopLoading(loadingId)` سپس `reportError` تا
loadingSet همیشه با واقعیت هم‌خوان بماند.

## پیامدها

- رفتار صریح: پرامیس‌های قدیمی بعد از reset کاملاً نادیده گرفته می‌شوند (resolve و reject هر دو).
- `pendingCount` پس از reject برابر پرامیس‌های واقعاً pending است.
- تست‌ها: `packages/suspense/test/suspense-generation.test.ts` (۶ مورد).
