// packages/events/src/modifier-registry.ts
//
// رجیستری modifierهای سفارشی رویداد — استخراج مکانیکی از modifiers.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { developerError, deprecate, onGlobalReset } from '@zenith/errors';


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
export const _customModifiers = new Map<string, EventModifierHandler>();

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
  'passive',
  'capture',
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
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که فقط در صورتی
 *           modifier را حذف می‌کند که همان handler هنوز ثبت باشد.
 */
export function registerEventModifier(name: string, handler: EventModifierHandler): () => void {
  if (typeof name !== 'string' || name.length === 0) {
    throw developerError(
      `Event modifier name must be a non-empty string. Received: ${String(name)}`,
    );
  }
  // امنیت: نام modifier فقط شامل حروف/اعداد/خط تیره باشد تا با parsing
  // modifier ها (`split('.')`) تداخل نداشته باشد.
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
    throw developerError(
      `Invalid event modifier name "${name}". Names must start with a letter ` +
        `and may contain letters, digits, and hyphens.`,
    );
  }
  if (BUILTIN_MODIFIERS.has(name)) {
    throw developerError(
      `Cannot register built-in modifier "${name}". Built-in modifiers are reserved.`,
    );
  }
  if (typeof handler !== 'function') {
    throw developerError(`Event modifier handler must be a function. Received: ${typeof handler}`);
  }
  _customModifiers.set(name, handler);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (_customModifiers.get(name) === handler) {
      _customModifiers.delete(name);
    }
  };
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
  deprecate('ZEN-DEPR-061', 'clearEventModifiers', 'resetForTesting() (@zenith/testing)');
  clearEventModifiersInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearEventModifiersInternal(): void {
  _customModifiers.clear();
}

/* @__PURE__ */ onGlobalReset(clearEventModifiersInternal);

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