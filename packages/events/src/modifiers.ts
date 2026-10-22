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


import { deprecate } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { _customModifiers, BUILTIN_MODIFIERS } from './modifier-registry';

/**
 * #136: استخراج گزینه‌های استاندارد `AddEventListenerOptions` (`once`, `passive`, `capture`)
 * از لیست modifierهای رویداد.
 */
export function extractListenerOptions(modifiers: string[]): AddEventListenerOptions {
  return {
    once: modifiers.includes('once'),
    passive: modifiers.includes('passive'),
    capture: modifiers.includes('capture'),
  };
}

const _passivePreventWarned = new Set<string>();

function warnPassivePreventOnce(eventType: string): void {
  if (_passivePreventWarned.has(eventType)) return;
  _passivePreventWarned.add(eventType);
  logger.warn(
    `[Zenith] ".prevent" is ignored for "${eventType}": the listener is passive ` +
      `(scroll-blocking events and ".passive" bindings can never call preventDefault()).`,
  );
}

/** For tests/HMR: forget which passive+prevent warnings were already printed. */
export function resetPassiveWarnings(): void {
  _passivePreventWarned.clear();
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
 * @param options   گزینه‌ها (`{ element, listenerIsPassive }`) یا — قدیمی — element و flag.
 * @returns `true` اگر رویداد مجاز به ادامه است، `false` اگر باید متوقف شود.
 */
/** @public */
export interface ApplyBehaviorModifiersOptions {
  /** عنصری که zen-action روی آن تعریف شده (برای `.self`). */
  element?: HTMLElement;
  /** listener به‌صورت passive ثبت شده و نمی‌تواند preventDefault کند. @default false */
  listenerIsPassive?: boolean;
}

/** @public */
export function applyBehaviorModifiers(
  event: Event,
  modifiers: string[],
  options?: ApplyBehaviorModifiersOptions,
): boolean;
/** @public @deprecated #55 — امضای positional؛ از `applyBehaviorModifiers(event, modifiers, { element, listenerIsPassive })` استفاده کنید (ZEN-DEPR-071، حذف در ۲.۰). */
export function applyBehaviorModifiers(
  event: Event,
  modifiers: string[],
  element?: HTMLElement,
  listenerIsPassive?: boolean,
): boolean;
export function applyBehaviorModifiers(
  event: Event,
  modifiers: string[],
  elementOrOptions?: HTMLElement | ApplyBehaviorModifiersOptions,
  legacyListenerIsPassive = false,
): boolean {
  // #55: هر دو آرگومان آبجکت‌اند؛ شکل قدیمی element (EventTarget) را از
  // شکل جدید با کلیدها و آرگومان چهارم تشخیص می‌دهیم. `{}` خالی شکل جدید است.
  // (شکل قدیمِ `(…, undefined, flag)` با arguments.length شناسایی می‌شود تا
  // flag گم نشود.)
  const isNewShape =
    ((elementOrOptions === undefined && arguments.length <= 3) ||
      (typeof elementOrOptions === 'object' &&
        elementOrOptions !== null &&
        !(elementOrOptions instanceof EventTarget) &&
        (Object.keys(elementOrOptions).length === 0 ||
          'element' in elementOrOptions ||
          'listenerIsPassive' in elementOrOptions)));
  if (!isNewShape) {
    deprecate(
      'ZEN-DEPR-071',
      'applyBehaviorModifiers(event, modifiers, element, listenerIsPassive)',
      'applyBehaviorModifiers(event, modifiers, { element, listenerIsPassive })',
    );
  }
  const element = isNewShape
    ? (elementOrOptions as ApplyBehaviorModifiersOptions | undefined)?.element
    : (elementOrOptions as HTMLElement | undefined);
  const listenerIsPassive = isNewShape
    ? ((elementOrOptions as ApplyBehaviorModifiersOptions | undefined)?.listenerIsPassive ?? false)
    : legacyListenerIsPassive;
  // ── ۱. `.self` — فقط اگر event.target خود element باشد ──
  // مفید برای جلوگیری از اجرای اکشن وقتی رویداد از یک فرزند bubble می‌شود.
  if (modifiers.includes('self') && element) {
    if (event.target !== element) {
      return false;
    }
  }

  // ── ۲. modifier های رفتاری اصلی ──
  if (modifiers.includes('prevent')) {
    // #136: a passive listener promises never to call preventDefault() — the platform ignores
    // the call and logs a console error, so skip it and tell the author once per event type.
    if (listenerIsPassive || modifiers.includes('passive')) {
      warnPassivePreventOnce(event.type);
    } else {
      event.preventDefault();
    }
  }
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
          logger.error(
            `[Zenith] Custom event modifier "${modName}" threw: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
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
  // #136: scroll-blocking events — registered passive at the delegation root.
  'touchstart',
  'touchmove',
  'touchend',
  'scroll',
] as const;

/**
 * #136: events the delegation root listens to as `passive: true` (the platform's own default
 * for document-level wheel/touch listeners, and what keeps scrolling smooth). `preventDefault()`
 * is a no-op there, so `.prevent` on these events is ignored with a one-time warning.
 */
export const PASSIVE_BY_DEFAULT_EVENTS: ReadonlySet<string> = new Set([
  'wheel',
  'touchstart',
  'touchmove',
  'scroll',
]);

/** #136: events that do not bubble — observed through a capture-phase root listener only. */
export const NON_BUBBLING_EVENTS: ReadonlySet<string> = new Set(['scroll']);

export type DelegatedEventName = (typeof DELEGATED_EVENTS)[number];

