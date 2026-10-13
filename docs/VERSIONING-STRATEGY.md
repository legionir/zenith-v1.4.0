# استراتژی نسخه‌گذاری و تولید خودکار CHANGELOG (`#72` — Versioning Strategy)

این سند تصمیم معماری و فرایند نسخه‌گذاری پکیج‌های منوریپوی Zenith را مشخص می‌کند.

---

## ۱. نسخه‌گذاری همگام (Lockstep Versioning — `DEC-029`)

تمام پکیج‌های قابل انتشار `@zenith/*` و پکیج چتر `zenith` از مدل **نسخه‌گذاری همگام (Lockstep)** پیروی می‌کنند:

1. **یک شمارهٔ نسخه برای کل فریم‌ورک**: نسخهٔ فعلی همهٔ پکیج‌های عمومی همواره یکسان است (مثلاً `1.4.0`) تا توسعه‌دهنده هرگز درگیر جدول سازگاری نسخه‌های متفرقه میان `@zenith/router`, `@zenith/state`, `@zenith/runtime` و `@zenith/ssr` نشود.
2. **وابستگی‌های Peer انعطاف‌پذیر (`^1.4.0`)**: پکیج‌های مصرف‌کننده، `@zenith/state` و `@zenith/scheduler` را در `peerDependencies` با بازهٔ `"^1.4.0"` اعلام می‌کنند (`scripts/peer-rule.mjs`) تا npm/pnpm/yarn در درخت وابستگی مصرف‌کننده همیشه یک کپی واحد را dedupe کند.
3. **پیکربندی Changesets (`.changeset/config.json`)**: آرایهٔ `"fixed": [["@zenith/*", "zenith"]]` تضمین می‌کند که هر تغییر در هر پکیج، نسخهٔ کل خانواده را به‌صورت همگام ارتقا می‌دهد.

---

## ۲. تولید خودکار CHANGELOG و تگ انتشار

1. **ثبت تغییر در PR**: هر PR تغییرمحور یک فایل در `.changeset/<slug>.md` ثبت می‌کند.
2. **محاسبهٔ نسخه و تولید Keep a Changelog**: اسکریپت `scripts/changeset.mjs` فایل‌های `.changeset/*.md` را پارس کرده، بالاترین سطح تغییر (`major` / `minor` / `patch`) را محاسبه می‌کند و بخش استاندارد [Keep a Changelog](https://keepachangelog.com/fa/1.0.0/) (`### Breaking Changes`, `### Added`, `### Fixed`) را تولید می‌نماید.
3. **انتشار خودکار از تگ**: با ثبت تگ `vX.Y.Z`، ورک‌فلوی `.github/workflows/release.yml` بیلد، تست، انتشار با `--provenance` و پیوست باندل‌ها به GitHub Release را به‌طور خودکار انجام می‌دهد.
