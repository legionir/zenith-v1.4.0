# درخواست‌های آمادهٔ مالک — remediation W0/W1 — ۲۰۲۶-۱۰-۱۶

**وضعیت ارسال: ارسال نشده.** تلاش `gh issue comment 77 --body-file ...` با
`Resource not accessible by integration` رد شد. هیچ کامنت/برچسبی ثبت نشده؛ ادامهٔ
نوشتن issue نیازمند اصلاح مجوز اتصال GitHub در Arena است. این متن‌ها آمادهٔ انتقال
به issueها هستند، نه شاهد انجام اقدام بیرونی. credential/کد 2FA/token ارسال نشود.

مالک مخزن در GitHub طبق `gh repo view --json owner,defaultBranchRef`، `legionir` و شاخهٔ
اصلی `main` است. این داده، مالکیت npm یا release access فرد دوم را اثبات نمی‌کند.
مسئول هر اقدام باید توسط مالک تعیین شود؛ assignee در آغاز batch برای این موارد خالی بود.

## #77 — مالک npm / scope

لطفاً مسئول npm، scope نهایی و دسترسی دو مالک واقعی و 2FA را تأیید کنید. پاسخ 404
یک نام پکیج، شاهد آزادبودن یا مالکیت scope نیست. انتخاب @zenith یا fallback باید پیش
از انتشار صریح باشد. هیچ npm publish یا تغییر دسترسی از طرف عامل انجام نشده است.
ارتباط: #66/#80/#107؛ تا شاهد قطعی باز بماند.

## #61 — ممیزی مستقل

لطفاً مسئول امنیت و ممیز مستقل را تعیین کنید؛ دامنه و SHA تحویل باید ثبت و گزارش
امضاشدهٔ بیرونی با پیگیری یافته‌ها ارائه شود. `docs/security/AUDIT-PACKAGE.md` بستهٔ
داخلی تحویل است، نه گواهی ممیزی مستقل. صفر audit جای ممیزی کد/CSP/SSR را نمی‌گیرد.
گزارش بیرونی دریافت نشده؛ issue باز بماند.

## #80 — حفاظت واقعی main / release

لطفاً ادمین مخزن را تعیین و review/Code Owners، required checks، ممنوعیت force push
روی main و حفاظت محیط release را تأیید کنید. PR کنترل‌شده با check قرمز یا بدون
review باید قابل merge نباشد. CODEOWNERS به‌تنهایی شاهد حفاظت نیست.
protection API از اتصال موجود 403 داد؛ از این نتیجه فعال/غیرفعال بودن استنتاج نمی‌شود.
دو check جدید Vite 6/7 هم در required checks بررسی شوند. عامل تنظیمات را تغییر نداده است.

## #107 — دو نگه‌دارندهٔ واقعی و تیم‌های معتبر

لطفاً دو حساب واقعی، نقش/write/release access آن‌ها و شناسه‌های معتبر CODEOWNERS
را تأیید کنید. وجود رشتهٔ @zenith-framework/core-maintainers یا security-reviewers
در فایل‌ها، شاهد وجود تیم معتبر در این مخزن شخصی نیست. `MAINTAINERS.md` و
`docs/MANUAL-STEPS.md` اکنون ادعاهای دسترسی را تأییدنشده/سیاست هدف می‌نامند.
هیچ نام/حساب جایگزین اختراعی اضافه نمی‌شود؛ issue تا تأیید مالک باز بماند.

## #66 — Trusted Publishing / OIDC

لطفاً مالک npm و ادمین GitHub را تعیین کنید: اتصال Trusted Publisher به مخزن، workflow
و environment درست، required reviewer محیط release و حذف token بلندمدت باید تأیید شود.
مسیر هدف OIDC است، نه درخواست NPM_TOKEN. workflow/provenance flags شاهد تنظیم واقعی
یا artifact منتشرشدهٔ دارای provenance نیستند. انتشار واقعی یا تغییر دسترسی انجام نشده است.
