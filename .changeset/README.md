# Changesets (`#72`)

این پوشه شامل فایل‌های تغییرات (Changesets) برای نسخه‌گذاری همگام (Lockstep) و تولید خودکار `CHANGELOG.md` در منوریپوی Zenith است.

## نحوهٔ ثبت تغییر جدید

برای هر PR تغییرمحور، یک فایل مارک‌داون در پوشهٔ `.changeset/` (مثلاً `.changeset/fix-suspense-mindelay.md`) با ساختار زیر بسازید:

```markdown
---
"@zenith/suspense": patch
---

رفع مشکل فعال نشدن تایمر `minDelay` و تفکیک خطاهای هم‌پیام (#21, #22).
```

از آنجا که تمام پکیج‌های `@zenith/*` و `zenith` در گروه `fixed` داخل `.changeset/config.json` قرار دارند، بالاترین سطح تغییر (`major` > `minor` > `patch`) به‌صورت همگام (Lockstep) روی همهٔ پکیج‌های قابل انتشار اعمال می‌شود.
