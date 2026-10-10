# DEC-026: نسخه‌گذاری — lockstep روی `1.5.0` برای پکیج‌های جدید؛ حذف نام‌های قدیمی فقط در `2.0.0`

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #58 (سیاست deprecation)، #141/#142/#143/#144/#145/#146/#147/#148/#149 (پکیج‌های جدید)، DEC-019 (wrapperها)

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۷ و بند نقشه: «همهٔ پکیج‌های جدید با `1.5.0` (lockstep با بقیه). حذف نام‌های قدیمی فقط در `2.0.0` و پس از یک نسخهٔ deprecation.» مخزن امروز همه‌جا `1.4.0` یکسان دارد (npm workspaces، lockfile، peerهای caret `^1.4.0` طبق DEC-018).

## گزینه‌ها

- **الف) نسخه‌گذاری مستقل هر پکیج (independent versioning)** — matrix سازگاری peerها (`state ^1.4` با `shared 3.2`؟) برای مصرف‌کننده غیرقابل‌تحلیل می‌شود و ابزار monorepo (changeset بدون config پیشرفته) را پیچیده می‌کند. ❌
- **ب) lockstep: کل workspace یک عدد؛ پکیج‌های جدید از ابتدا `1.5.0`؛ bump همه در هر release**. ✅ (پیش‌فرض SPEC)
- **ج) lockstep + pre-release برای پکیج‌های تازه (0.x تا بلوغ)** — دو مقیاس نسخه در یک registry با قاعدهٔ peer caret سازگار نیست. ❌

## تصمیم و دلیل

گزینهٔ ب — پیش‌فرض SPEC، و الگوی npm/Node و React/Vue monorepoها (lockstep) که با peerهای caret مخزن سازگارترین است. توالی اجرایی:
1. در موج ۲ (۱۴۱→۱۴۹) هر پکیج جدید با `version: 1.5.0` و peerهای `^1.5.0` متولد می‌شود؛ در همان release-cycle، کل مخزن به `1.5.0` bump می‌شود (bump همه با یک changeset major-free minor؛ scripts/standardize-packages.mjs گسترش می‌یابد).
2. حذف نام/API قدیمی (wrapperهای ZEN-DEPR DEC-019، aliasهای #116، `processVirtualList`/`enter/leaveTransition`/`animateGroup`) فقط در `2.0.0` و پس از حداقل یک نسخهٔ کامل deprecation-شده (#58) — یعنی اگر ۱.۵ و ۱.۶ هشدار داشتند، حذف در ۲.۰.
3. `engines` و قالب dual بر اساس DEC-027.

## پیامدها

- CHANGELOG ریشه lockstep نگه داشته می‌شود (#86–#112 مستندات)؛ release-please/changeset در #71–#76 همین را پیکربندی می‌کند.
- peer caretها همیشه `^<lockstep>`‌اند؛ گیت #46 (DEC-018) همین invariant را چک می‌کند.
- هزینهٔ «ورژن بی‌تغییر برای پکیج دست‌نخورده» می‌پذیریم — trade-off صریح SPEC است.
