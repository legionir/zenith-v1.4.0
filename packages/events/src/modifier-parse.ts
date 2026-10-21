// packages/events/src/modifier-parse.ts
//
// parse binding و modifierهای کیبورد — استخراج مکانیکی از modifiers.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


/**
 * خروجی تجزیه‌ی یک Attribute Name.
 *
 * @example
 * parseAttributeName('zen-action:keydown.enter')
 *   → { event: 'keydown', modifiers: ['enter'] }
 */
export interface ParsedEventBinding {
  /** نام رویداد بدون پسوند. مثلا: `click`, `keydown` */
  eventName: string;
  /** لیست modifier ها. مثلا: `['prevent', 'enter']` */
  modifiers: string[];
}

/**
 * تجزیه‌ی بخش «binding» از نام Attribute.
 *
 * این تابع فقط بخش بعد از `zen-action:` را می‌گیرد:
 *   "click"             → { eventName: 'click',   modifiers: [] }
 *   "click.prevent"     → { eventName: 'click',   modifiers: ['prevent'] }
 *   "keydown.enter"     → { eventName: 'keydown', modifiers: ['enter'] }
 *   "keydown.shift.enter" → { eventName: 'keydown', modifiers: ['shift', 'enter'] }
 *
 * نکته: نام رویداد همیشه اولین قسمت است (قبل از اولین `.`).
 *
 * @param rawBinding بخش بعد از `zen-action:` در نام attribute.
 */
export function parseBinding(rawBinding: string): ParsedEventBinding {
  const parts = rawBinding.split('.');
  const eventName = parts[0] ?? '';
  const modifiers = parts.slice(1).filter((m) => m.length > 0);
  return { eventName, modifiers };
}

/**
 * بررسی اینکه آیا رویداد کیبورد، شرط‌های modifier های کلیدی را برآورده می‌کند.
 *
 * پشتیبانی از:
 *   - `enter`   → event.key === 'Enter'
 *   - `escape`  → event.key === 'Escape'
 *   - `tab`     → event.key === 'Tab'
 *   - `space`   → event.key === ' ' یا 'Space'
 *   - `backspace` → event.key === 'Backspace'
 *   - `del`     → event.key === 'Delete'
 *   - `up` / `down` / `left` / `right` → کلیدهای جهت‌نما
 *   - `shift` / `ctrl` / `alt` / `meta` → کلیدهای اصلاحی
 *
 * اگر هیچ key-modifier ای در لیست نباشد، `true` برمی‌گردد (یعنی کلید مهم نیست).
 *
 * @param event     رویداد کیبورد.
 * @param modifiers لیست modifier ها.
 * @returns `true` اگر رویداد مجاز به اجرای اکشن است.
 */
export function checkKeyboardModifiers(event: KeyboardEvent, modifiers: string[]): boolean {
  // ── ۱. کلیدهای اصلاحی (Shift/Ctrl/Alt/Meta) ──
  // این modifierها روی خود event flag دارند.
  if (modifiers.includes('shift') && !event.shiftKey) return false;
  if (modifiers.includes('ctrl') && !event.ctrlKey) return false;
  if (modifiers.includes('alt') && !event.altKey) return false;
  if (modifiers.includes('meta') && !event.metaKey) return false;

  // ── ۲. کلیدهای خاص (key-based) ──
  // اگر هیچ key-modifier ای در لیست نباشد، این مرحله skip می‌شود.
  const keyMap: Record<string, string[]> = {
    enter: ['Enter'],
    escape: ['Escape', 'Esc'],
    tab: ['Tab'],
    space: [' ', 'Space', 'Spacebar'],
    backspace: ['Backspace'],
    del: ['Delete', 'Del'],
    up: ['ArrowUp', 'Up'],
    down: ['ArrowDown', 'Down'],
    left: ['ArrowLeft', 'Left'],
    right: ['ArrowRight', 'Right'],
  };

  // اولین key-modifier پیدا شده را بررسی کن.
  // اگر چند تا بودند (مثلاً enter + escape)، یکیشان کافی است (OR منطقی).
  const keyModifiers = modifiers.filter((m) => m in keyMap);
  if (keyModifiers.length > 0) {
    const allowed = keyModifiers.some((m) => keyMap[m]!.includes(event.key));
    if (!allowed) return false;
  }

  return true;
}