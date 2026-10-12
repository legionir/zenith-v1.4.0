// packages/cli/src/validate-project-name.ts
//
// AUDIT CLI-03 (#7): جلوگیری از directory traversal در `zenith create`.
//
// قبلاً فقط NFC normalize می‌شد و `path.join(process.cwd(), projectName)`
// هر ورودی‌ای را می‌پذیرفت: `../x` بیرون از cwd پوشه می‌ساخت، `/etc/x` مطلق
// بود (join آن را دور می‌زند)، `a/b` چند-بخشی و نام‌های رزرو ویندوز.
//
// این ماژول عمداً از index.ts جداست تا بدون اجرای `program.parse` قابل
// import و تست باشد (index.ts در لحظهٔ import کلمه‌اثر side-effect دارد).

import path from 'path';

/** حداکثر طول مجاز نام پروژه (فایل‌سیستم‌های رایج ۲۵۵ بایت اجازه می‌دهند). */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** نام‌های رزرو ویندوز (بی‌اهمیت نسبت به بزرگی/کوچکی حروف؛ با پسوند هم رزرو). */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * الگوی مجاز: حروف لاتین بزرگ/کوچک، رقم، `-`، `_`، `.`؛ باید با رقم یا حرف
 * شروع شود تا `..` و نام‌های نقطه‌دار مخفی (`.hidden`, `..x`) رد شوند.
 * `/` و `\` و هر کاراکتر دیگر (فاصله، `:`، UTF-8 جداکننده‌نما) ممنوع است.
 */
const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * اعتبارسنجی نام پروژهٔ `zenith create`.
 *
 * @param name ورودی خام کاربر (قبل از هر normalize).
 * @param cwd  مسیر مرجع؛ resolve نهایی باید داخل آن بماند (پیش‌فرض process.cwd()).
 * @returns `null` اگر معتبر است، وگرنه پیام خطای روشن و قابل‌اقدام.
 */
export function validateProjectName(name: string, cwd: string = process.cwd()): string | null {
  const trimmed = name.normalize('NFC');

  if (trimmed.length === 0) {
    return 'Project name must not be empty.';
  }
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    return `Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters (got ${trimmed.length}).`;
  }
  // مسیر مطلق POSIX/ویندوزی — حتی پیش از الگو، چون path.join یک ورودی
  // مطلق را «جایگزین» cwd می‌کند و از آن فرار می‌کند.
  if (/^([/\\]|[a-zA-Z]:[\\/])/.test(trimmed)) {
    return 'Project name must not be an absolute path.';
  }
  // جداکننده مسیر در هر شکل (شامل backslash ویندوز و separatorهای یونیکد)
  if (/[/\\\u2024\u2025\u2215\uff0f\uff3c]/.test(trimmed)) {
    return 'Project name must not contain path separators.';
  }
  if (!VALID_NAME.test(trimmed)) {
    return 'Project name may only contain letters, digits, "-", "_" and ".", and must start with a letter or digit.';
  }
  if (WINDOWS_RESERVED.test(trimmed)) {
    return `"${trimmed}" is a reserved Windows device name.`;
  }
  // لنگهٔ نهایی: resolve داخل cwd بماند (defense-in-depth).
  const resolved = path.resolve(cwd, trimmed);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return 'Resolved project path escapes the current directory.';
  }
  return null;
}
