// packages/unplugin-zenith/src/plugin-glob.ts
/**
 * تبدیل یک glob pattern ساده به RegExp.
 * از `**` (recursive), `*` (single-segment), `?` (single char) پشتیبانی می‌کند.
 * برای watchPatterns استفاده می‌شود تا کاربر بتواند از glob pattern استفاده کند.
 */
/** @public */
export function globToRegex(pattern: string): RegExp {
  let escaped = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i);
    if (ch === '*' && pattern.charAt(i + 1) === '*') {
      // ** → مسیر بازگشتی
      escaped += '.*';
      i++; // کاراکتر دوم * را رد کن
      // اسلش بعدی اختیاری است
      if (pattern.charAt(i + 1) === '/' || pattern.charAt(i + 1) === '\\') i++;
    } else if (ch === '*') {
      // * → هر مقدار به جز جداکننده مسیر
      escaped += '[^/\\\\]*';
    } else if (ch === '?') {
      escaped += '[^/\\\\]';
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      escaped += '\\' + ch;
    } else {
      escaped += ch;
    }
  }
  return new RegExp(escaped);
}
