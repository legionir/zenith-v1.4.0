// packages/events/src/delegation.ts
//
// موتور اصلی Event Delegation — قلب فاز ۴.
//
// ایده:
//   به‌جای اینکه برای هر دکمه یک Event Listener جداگانه ثبت کنیم (که با
//   اضافه/حذف شدن عناصر توسط zen-if دردسرساز می‌شود)، فقط **یک Listener
//   روی root** برای هر نوع رویداد ثبت می‌کنیم. وقتی رویداد رخ می‌دهد،
//   با `closest()` عنصری که `zen-action` دارد را پیدا کرده و اکشن را اجرا می‌کنیم.
//
// مزایا:
//   1) Memory: O(event types) به‌جای O(elements). ۱۰۰۰۰ دکمه = ۱ listener.
//   2) Dynamic elements: عناصری که بعد از mount اضافه می‌شوند (مثلاً توسط
//      zen-if=true) به‌صورت خودکار کار می‌کنند — نیازی به re-bind نیست.
//   3) Performance: خیلی سریع‌تر از bind کردن دستی به هر عنصر.
//
// FEATURE (v1.3.0):
//   - Custom root: `initEventDelegation(state, { root })` قبول می‌کند
//     Document | ShadowRoot | HTMLElement. این اجازه می‌دهد Event Delegation
//     داخل Shadow DOM یا iframe یا یک subtree خاص کار کند.
//   - Binding Cache: WeakMap<HTMLElement, CachedBinding> که نتیجه‌ی parse
//     را cache می‌کند. اگر attribute های `zen-action*` عنصر تغییر نکرده
//     باشند، از cache استفاده می‌شود و re-parse انجام نمی‌شود.
//   - Parameterized Actions: `zen-action="save($item, $product.id)"`.
//     آرگومان‌ها با Expression Engine ارزیابی و در `ctx.args` قرار می‌گیرند.
//
// نحوه‌ی پیدا کردن binding:
//   در HTML می‌توان دو شکل نوشت:
//     <button zen-action="save">                       → پیش‌فرض: click
//     <button zen-action:click="save">                 → رویداد صریح
//     <button zen-action:click.prevent="save">         → رویداد + modifier
//     <button zen-action:keydown.enter="submit">       → keydown + enter
//     <button zen-action="save($item, $product.id)">   → FEATURE (v1.3.0): args

import { setCurrentPriority } from '@zenith/state';
import {
  DELEGATED_EVENTS,
  NON_BUBBLING_EVENTS,
  PASSIVE_BY_DEFAULT_EVENTS,
  type DelegatedEventName,
} from './modifiers';
import { delegateEvent, type TimedHandlerCache } from './delegate-event';
import type { DelegationPhase } from './binding-cache';

/**
 * FEATURE (v1.3.0): Type برای ریشه‌ی Event Delegation.
 *
 * - `Document`: حالت پیش‌فرض. تمام صفحه پوشش داده می‌شود.
 * - `ShadowRoot`: برای اجزای Web Component با Shadow DOM.
 * - `HTMLElement`: برای یک subtree خاص (مثلاً یک micro-frontend).
 */
export type DelegationRoot = Document | ShadowRoot | HTMLElement;

/**
 * FEATURE (v1.3.0): Options برای `initEventDelegation`.
 */
export interface InitEventDelegationOptions {
  /**
   * ریشه‌ای که Listener ها روی آن ثبت می‌شوند.
   *
   * پیش‌فرض: `document`.
   *
   * مثال‌ها:
   *   - `document` (پیش‌فرض) — کل صفحه.
   *   - `element.shadowRoot` — برای یک Web Component با Shadow DOM.
   *   - `myContainerEl` — برای یک subtree خاص.
   */
  root?: DelegationRoot;
}

/**
 * مقداردهی اولیه‌ی Event Delegation روی `root`.
 *
 * FEATURE (v1.3.0): پارامتر `options.root` اضافه شد. می‌تواند `Document`,
 * `ShadowRoot`, یا `HTMLElement` باشد. این اجازه می‌دهد Event Delegation
 * داخل Shadow DOM یا یک subtree خاص کار کند.
 *
 * مثال:
 *   // پیش‌فرض (document):
 *   const teardown = initEventDelegation(state);
 *
 *   // Shadow DOM:
 *   const teardown = initEventDelegation(state, { root: hostEl.shadowRoot });
 *
 *   // Subtree خاص:
 *   const teardown = initEventDelegation(state, { root: myContainerEl });
 *
 * @param state   آبجکت State کاربر.
 * @param options FEATURE (v1.3.0): `{ root }` برای custom delegation root.
 * @returns تابع teardown برای حذف تمام Listenerها.
 */
export function initEventDelegation(
  state: Record<string, unknown>,
  options?: InitEventDelegationOptions,
): () => void {
  // FEATURE (v1.3.0): Custom root.
  const root: DelegationRoot = options?.root ?? document;

  const listeners: Array<{
    name: DelegatedEventName;
    handler: (e: Event) => void;
    options: AddEventListenerOptions;
  }> = [];
  const timedHandlerCache: TimedHandlerCache = new Map();

  const register = (eventName: DelegatedEventName, phase: DelegationPhase) => {
    const handler = (event: Event) => {
      const oldPriority = setCurrentPriority('urgent');
      try {
        delegateEvent(event, state, eventName, timedHandlerCache, root, phase);
      } finally {
        setCurrentPriority(oldPriority);
      }
    };
    // #136: scroll-blocking events are passive at the root (no browser "non-passive listener"
    // violation, smooth scrolling); `capture` is a listener option, so `.capture` bindings get
    // their own capture-phase listener. Non-bubbling events (scroll) need capture to be seen.
    const options: AddEventListenerOptions = {
      capture: phase !== 'bubble',
      passive: PASSIVE_BY_DEFAULT_EVENTS.has(eventName),
    };
    // ثبت روی root. برای HTMLElement هم `addEventListener` وجود دارد.
    root.addEventListener(eventName, handler as EventListener, options);
    listeners.push({ name: eventName, handler, options });
  };

  for (const eventName of DELEGATED_EVENTS) {
    if (NON_BUBBLING_EVENTS.has(eventName)) {
      register(eventName, 'any');
    } else {
      register(eventName, 'bubble');
      register(eventName, 'capture');
    }
  }

  return function teardown() {
    for (const { name, handler, options } of listeners) {
      root.removeEventListener(name, handler as EventListener, options);
    }
    listeners.length = 0;
    // FIX (v1.2.7): cancel pending debounce/throttle timers.
    for (const elementCache of timedHandlerCache.values()) {
      for (const wrapped of elementCache.values()) {
        try {
          wrapped.cancel();
        } catch {
          /* ignore */
        }
      }
      elementCache.clear();
    }
    timedHandlerCache.clear();
  };
}
// #40: سازگاری barrel (`from './delegation'`) — این نام‌ها از ماژول
// delegate-event دوباره export می‌شوند؛ سطح عمومی عین قبل است.
export {
  setLinkNavigationHandler,
  getLinkNavigationHandler,
  type LinkNavigationHandler,
} from './delegate-event';
