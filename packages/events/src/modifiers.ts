// packages/events/src/modifiers.ts
//
// تجزیه و اعمال Modifier های رویداد.
//
// در HTML می‌توان پسوند‌هایی به binding اضافه کرد:
//   zen-action:click.prevent.stop      → preventDefault + stopPropagation
//   zen-action:keydown.enter           → فقط وقتی Enter زده شد
//   zen-action:keydown.escape.shift    → Escape + Shift
//
// این فایل دو مسئولیت دارد:
//   1) parseBinding: تجزیه رشته‌ای مثل "click.prevent.stop" به بخش‌هایش.
//   2) اعمال رفتار: checkKeyboardModifiers و applyBehaviorModifiers.
//
// FEATURE (v1.3.0): Event Modifier Registry.
//   Plugin ها می‌توانند با `registerEventModifier(name, handler)` modifierهای
//   سفارشی (مثل `.longpress`, `.swipe`, `.doubletap`) اضافه کنند.

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
export function checkKeyboardModifiers(
  event: KeyboardEvent,
  modifiers: string[],
): boolean {
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
    const allowed = keyModifiers.some((m) =>
      keyMap[m]!.includes(event.key),
    );
    if (!allowed) return false;
  }

  return true;
}

/**
 * FEATURE (v1.3.0): Event Modifier Handler.
 *
 * Plugin ها می‌توانند با `registerEventModifier(name, handler)` رفتارهای
 * سفارشی برای modifier های رویداد تعریف کنند. مثلاً:
 *
 *   registerEventModifier('longpress', (event, modifiers, element) => {
 *     // event: رویداد اصلی. element: عنصر delegate.
 *     // modifiers: کل لیست modifier ها.
 *     // return false برای جلوگیری از اجرای اکشن.
 *     return true;
 *   });
 *
 * Handler قبل از اجرای اکشن صدا زده می‌شود. اگر `false` برگرداند،
 * اکشن اجرا نمی‌شود. اگر `true` یا `undefined` برگرداند، اکشن اجرا می‌شود.
 *
 * Built-in modifier ها (`prevent`, `stop`, `immediate`, `self`, `enter`,
 * `escape`, ...) توسط فریم‌ورک مدیریت می‌شوند و قابل override نیستند.
 */
export type EventModifierHandler = (
  event: Event,
  modifiers: string[],
  element: HTMLElement,
) => boolean | void;

/**
 * FEATURE (v1.3.0): Registry از Event Modifier های سفارشی.
 *
 * Plugin ها می‌توانند modifier های جدید ثبت کنند. Built-in modifier ها
 * در این Map قرار نمی‌گیرند — آنها توسط کد سخت‌گیرانه‌ی `applyBehaviorModifiers`
 * و `checkKeyboardModifiers` مدیریت می‌شوند و قابل override نیستند.
 */
const _customModifiers = new Map<string, EventModifierHandler>();

/**
 * FEATURE (v1.3.0): مجموعه‌ی نام modifier های built-in.
 *
 * این موارد قابل ثبت مجزا توسط plugin ها نیستند — اگر کاربر سعی کند
 * یکی از این نام‌ها را ثبت کند، `registerEventModifier` استثنا پرتاب می‌کند.
 */
export const BUILTIN_MODIFIERS = new Set<string>([
  'prevent',
  'stop',
  'immediate',
  'self',
  'once',
  'debounce',
  'throttle',
  // Keyboard key-modifiers
  'enter',
  'escape',
  'tab',
  'space',
  'backspace',
  'del',
  'up',
  'down',
  'left',
  'right',
  // Modifier keys
  'shift',
  'ctrl',
  'alt',
  'meta',
]);

/**
 * FEATURE (v1.3.0): ثبت یک Event Modifier سفارشی.
 *
 * مثال:
 *   registerEventModifier('longpress', (event, modifiers, element) => {
 *     // پیاده‌سازی longpress
 *     return true;
 *   });
 *
 *   // حالا در HTML:
 *   // <button zen-action:click.longpress="save">Long press to save</button>
 *
 * @param name    نام modifier (بدون نقطه). مثلاً `'longpress'`.
 * @param handler تابعی که قبل از اجرای اکشن صدا زده می‌شود.
 *                اگر `false` برگرداند، اکشن اجرا نمی‌شود.
 * @throws اگر نام خالی باشد، یک built-in باشد، یا handler تابع نباشد.
 */
export function registerEventModifier(
  name: string,
  handler: EventModifierHandler,
): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(
      `[Zenith] Event modifier name must be a non-empty string. Received: ${String(name)}`,
    );
  }
  // امنیت: نام modifier فقط شامل حروف/اعداد/خط تیره باشد تا با parsing
  // modifier ها (`split('.')`) تداخل نداشته باشد.
  if (!/^[a-zA-Z][a-zA-Z0-9\-]*$/.test(name)) {
    throw new Error(
      `[Zenith] Invalid event modifier name "${name}". Names must start with a letter ` +
        `and may contain letters, digits, and hyphens.`,
    );
  }
  if (BUILTIN_MODIFIERS.has(name)) {
    throw new Error(
      `[Zenith] Cannot register built-in modifier "${name}". Built-in modifiers are reserved.`,
    );
  }
  if (typeof handler !== 'function') {
    throw new Error(
      `[Zenith] Event modifier handler must be a function. Received: ${typeof handler}`,
    );
  }
  _customModifiers.set(name, handler);
}

/**
 * FEATURE (v1.3.0): حذف یک Event Modifier سفارشی.
 */
export function unregisterEventModifier(name: string): boolean {
  return _customModifiers.delete(name);
}

/**
 * FEATURE (v1.3.0): پاکسازی تمام Event Modifier های سفارشی.
 *
 * مفید برای HMR و تست‌ها.
 */
export function clearEventModifiers(): void {
  _customModifiers.clear();
}

/**
 * FEATURE (v1.3.0): بررسی وجود یک Event Modifier سفارشی.
 */
export function hasEventModifier(name: string): boolean {
  return _customModifiers.has(name);
}

/**
 * FEATURE (v1.3.0): دریافت یک Event Modifier سفارشی.
 */
export function getEventModifier(name: string): EventModifierHandler | undefined {
  return _customModifiers.get(name);
}

/**
 * اعمال modifier های رفتاری روی رویداد.
 *
 *   - `prevent`    → event.preventDefault()
 *   - `stop`       → event.stopPropagation()
 *   - `immediate`  → event.stopImmediatePropagation()
 *   - `self`       → فقط اگر event.target === element باشد اجرا شود
 *
 * FEATURE (v1.3.0): اگر هر custom modifier (ثبت‌شده با `registerEventModifier`)
 * `false` برگرداند، `applyBehaviorModifiers` هم `false` برمی‌گرداند و اکشن
 * اجرا نمی‌شود.
 *
 * ترتیب اعمال: self → prevent → stop → immediate → custom modifiers.
 *
 * @param event     رویداد اصلی.
 * @param modifiers لیست modifier ها.
 * @param element   عنصری که zen-action روی آن تعریف شده (برای `.self`).
 * @returns `true` اگر رویداد مجاز به ادامه است، `false` اگر باید متوقف شود.
 */
export function applyBehaviorModifiers(
  event: Event,
  modifiers: string[],
  element?: HTMLElement,
): boolean {
  // ── ۱. `.self` — فقط اگر event.target خود element باشد ──
  // مفید برای جلوگیری از اجرای اکشن وقتی رویداد از یک فرزند bubble می‌شود.
  if (modifiers.includes('self') && element) {
    if (event.target !== element) {
      return false;
    }
  }

  // ── ۲. modifier های رفتاری اصلی ──
  if (modifiers.includes('prevent')) event.preventDefault();
  if (modifiers.includes('stop')) event.stopPropagation();
  if (modifiers.includes('immediate')) event.stopImmediatePropagation();

  // ── ۳. FEATURE (v1.3.0): custom modifier ها ──
  // هر modifier ثبت‌شده با `registerEventModifier` اینجا صدا زده می‌شود.
  // اگر هر کدام `false` برگردانند، کل عملیات متوقف می‌شود.
  if (_customModifiers.size > 0) {
    for (const modName of modifiers) {
      // skip built-in ها (همان بالا پردازش شدند)
      if (BUILTIN_MODIFIERS.has(modName)) continue;
      // skip numeric tokens (مثلاً `300` در `debounce.300`)
      if (/^\d+$/.test(modName)) continue;
      const handler = _customModifiers.get(modName);
      if (handler) {
        try {
          const result = handler(event, modifiers, element ?? (event.currentTarget as HTMLElement));
          if (result === false) return false;
        } catch (err) {
          console.error(`[Zenith] Custom event modifier "${modName}" threw:`, err);
          // در صورت خطا، اجرای اکشن را متوقف نمی‌کنیم (fail-open).
        }
      }
      // اگر modifier ثبت نشده باشد، آن را نادیده می‌گیریم (نه خطا).
      // این رفتار backward-compatible است و از log spam جلوگیری می‌کند.
    }
  }

  return true;
}

/**
 * لیست رویدادهایی که در Event Delegation پشتیبانی می‌شوند.
 *
 * این رویدادها همگی bubble می‌کنند (یا در سطح document قابل capture هستند).
 *
 * BUG FIX (v7.0): `focusin` و `focusout` اضافه شدند (bubble می‌شوند برخلاف
 * focus/blur که نیاز به useCapture:true دارند).
 *
 * نکته: `submit` روی فرم‌ها هم bubble می‌کند (در HTML5 اصلاح شد).
 */
/**
 * IMP-EVT-04: لیست رویدادهای DOM که با Event Delegation پشتیبانی می‌شوند.
 *
 * اضافه شدن:
 *   - `dblclick`: برای کلیک دوبل
 *   - `contextmenu`: برای کلیک راست
 *   - `wheel`: برای اسکرول (bubble می‌کند)
 *   - `pointerdown` / `pointerup`: برای pointer events (در touch و mouse)
 *
 * این رویدادها همگی bubble می‌کنند و برای delegation مناسب هستند.
 */
export const DELEGATED_EVENTS = [
  'click',
  'dblclick',
  'contextmenu',
  'input',
  'change',
  'submit',
  'keydown',
  'keyup',
  'focusin',
  'focusout',
  'wheel',
  'pointerdown',
  'pointerup',
] as const;

export type DelegatedEventName = (typeof DELEGATED_EVENTS)[number];
