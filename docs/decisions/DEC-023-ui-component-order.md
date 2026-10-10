# DEC-023: ترتیب کامپوننت‌های `ui` — dialog, popover, tooltip, tabs سپس بقیه

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #153–#158 (پکیج‌های P1 اپیک ui)، #122–#125 (الگوهای هسته)

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۴: پکیج `ui` (L2؛ وابسته به shared, a11y, jalali, transition؛ بودجه ≤۱۵KB کل با tree-shaking هر کامپوننت) حجم کار بالایی دارد و SPEC پیشنهاد داده ابتدا `dialog`, `popover`, `tooltip`, `tabs` ساخته شوند.

## گزینه‌ها

- **الف) همان ترتیب پیشنهادی SPEC: dialog → popover → tooltip → tabs، سپس مابقی (date-picker از runtime استخراج، accordion, menu, …)** ✅
- **ب) ترتیب الفبایی/تصادفی** — از دست دادن وابستگی‌های فنی: dialog زیرساخت focus-trap/portal را می‌سازد که popover/tooltip/tabpanel مصرف می‌کنند. ❌
- **ج) ساخت همه با هم در یک نسخه** — ریسک حجم و ناقص‌ماندن a11y؛ خلاف معیارهای APG. ❌

## تصمیم و دلیل

گزینهٔ الف، همان پیش‌فرض SPEC (تصمیم جمعی بدون قید فنی خلاف — و برعکس: قید فنی هم به نفع آن است). توالی از نظر WAI-ARIA APG: `dialog` (modal + focus trap + `aria-modal`) پایهٔ primitive مشترک (portal, layer manager, keyboard stack) را می‌دهد؛ `popover` (light-dismiss، APG Popover) روی همان layer manager؛ `tooltip` (delay/focus semantics ساده‌تر، بدون focus trap)؛ `tabs` (roving tabindex + arrow keys) primitive کیبورد مستقل دارد ولی برای `date-picker` (که به tabs/keyboard grid و popover نیاز دارد) مقدم است. هر چهار تا APG Pattern کامل‌اند و با axe-core در CI تست می‌شوند (§ a11y SPEC).

## پیامدها

- هر کامپوننت یک مینور/پچ مستقل با flag خود؛ `ui@1.5.0` فقط این چهار + primitives را export می‌کند (DEC-026 lockstep).
- تست‌های e2e کیبورد (Tab/Shift+Tab/Esc/Home/End) + `prefers-reduced-motion` برای این چهار در موج ۴ الزامی می‌شود؛ بقیه با اضافه‌شدنشان.
- `zen-portal`/`zen-date-picker` از runtime در همین ترتیب (پس از dialog) استخراج می‌شوند تا مصرف‌کنندهٔ قدیمی alias deprecate بگیرد (الگوی DEC-019).
