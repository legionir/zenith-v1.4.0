// packages/events/src/delegate-event.ts
//
// اجرای رویداد delegate‌شده (zen-link + zen-action) — استخراج مکانیکی از
// delegation.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { getAction } from '@zenith/actions';
import { logger } from '@zenith/logger';
import { flushSync } from '@zenith/scheduler';
import { reportError } from '@zenith/error-boundary';
import { evaluateExpression } from '@zenith/expressions';
import {
  applyBehaviorModifiers,
  PASSIVE_BY_DEFAULT_EVENTS,
  type DelegatedEventName,
} from './modifiers';
import { checkKeyboardModifiers, parseBinding } from './modifier-parse';
import { applyTimingModifiers, type TimedHandler } from './timing-modifiers';
import { createContextForEval } from './action-parse';
import {
  _bindingCache,
  findBinding,
  findClosestActionElement,
  ZEN_ACTION_PREFIX,
  type DelegationPhase,
} from './binding-cache';


/**
 * #48 — جداسازی وابستگی معکوس `events -> router`.
 * هندلر ناوبری لینک‌های `[zen-link]` از بیرون (توسط `@zenith/runtime` یا `@zenith/router`)
 * تزریق می‌شود تا `@zenith/events` هیچ وابستگی مستقیمی به `@zenith/router` نداشته باشد.
 */
export type LinkNavigationHandler = (path: string) => void | Promise<void>;

let _linkNavigationHandler: LinkNavigationHandler | null = null;

/**
 * ثبت هندلر ناوبری برای لینک‌های `[zen-link]`.
 * یک تابع `Cleanup` idempotent برمی‌گرداند (#116).
 */
export function setLinkNavigationHandler(handler: LinkNavigationHandler | null): () => void {
  const prev = _linkNavigationHandler;
  _linkNavigationHandler = handler;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (_linkNavigationHandler === handler) {
      _linkNavigationHandler = prev;
    }
  };
}

export function getLinkNavigationHandler(): LinkNavigationHandler | null {
  return _linkNavigationHandler;
}

/**
 * FIX (v1.2.7): Per-element cache of timed (debounced/throttled) handlers.
 */
export type TimedHandlerCache = Map<HTMLElement, Map<string, TimedHandler & { cancel: () => void }>>;

/**
 * پردازش یک رویداد delegate‌شده.
 *
 * FEATURE (v1.3.0): پشتیبانی از Parameterized Actions.
 * اگر binding شامل `(...)` باشد (مثلاً `save($item)`), آرگومان‌ها با
 * `evaluateExpression` ارزیابی و در `ctx.args` قرار می‌گیرند.
 *
 * @param event رویداد DOM.
 * @param state آبجکت State کاربر.
 * @param eventName نام رویداد.
 * @param timedHandlerCache کش per-element از timed handlers.
 * @param root ریشه‌ی delegation برای مرزبندی walk.
 */
export function delegateEvent(
  event: Event,
  state: Record<string, unknown>,
  eventName: DelegatedEventName,
  timedHandlerCache: TimedHandlerCache,
  root: Document | ShadowRoot | HTMLElement,
  phase: DelegationPhase = 'any',
): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // ── فاز ۸: zen-link (تقدم بر zen-action برای click) ──
  if (eventName === 'click' && phase !== 'capture') {
    const linkEl = target.closest<HTMLElement>('[zen-link]');
    if (linkEl) {
      event.preventDefault();
      const path = linkEl.getAttribute('zen-link') || linkEl.getAttribute('href');
      if (path) {
        if (_linkNavigationHandler) {
          void _linkNavigationHandler(path);
        }
        flushSync();
      } else {
        logger.warn('[Zenith] <a zen-link> has no path (neither zen-link nor href attribute).');
      }
      return;
    }
  }

  const matched = findClosestActionElement(target, eventName, root, phase);
  if (!matched) return;

  const binding = findBinding(matched, eventName, phase);
  if (!binding) return;

  const { parsed, modifiers, element } = binding;
  const actionName = parsed.name;

  // ── ۱. بررسی کلیدهای کیبورد ──
  if (event instanceof KeyboardEvent) {
    if (!checkKeyboardModifiers(event, modifiers)) {
      return;
    }
  }

  // ── ۲. اعمال modifier های رفتاری ──
  // FIX (v1.2.7 sync drift): applyBehaviorModifiers حالا boolean برمی‌گرداند
  // و `element` می‌گیرد (برای `.self`). اگر `false` برگرداند، event را نادیده می‌گیریم.
  // #136: scroll-blocking events (wheel/touch*/scroll) are registered passive at the root, so
  // `.prevent` cannot work there — applyBehaviorModifiers skips it (with a one-time warning).
  const shouldProceed = applyBehaviorModifiers(event, modifiers, {
    element,
    listenerIsPassive: PASSIVE_BY_DEFAULT_EVENTS.has(eventName),
  });
  if (!shouldProceed) {
    return;
  }

  // ── ۳. اجرای اکشن ──
  const actionFn = getAction(actionName);
  if (actionFn) {
    const invokeAction = (ev: Event) => {
      // FEATURE (v1.3.0): ارزیابی آرگومان‌های Parameterized Action.
      let args: unknown[] | undefined;
      if (parsed.argExprs) {
        try {
          const ctx = createContextForEval(state);
          args = parsed.argExprs.map((expr) => evaluateExpression(expr, ctx));
        } catch (err) {
          logger.error(
            `[Zenith] Failed to evaluate args for action "${actionName}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          reportError(err as Error, 'action', { element });
          flushSync();
          return;
        }
      }

      try {
        const result = actionFn({ event: ev, state, element, args });
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            logger.error(
              `[Zenith] Async action "${actionName}" threw an error: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            reportError(err as Error, 'action', { element });
            flushSync();
          });
        }
      } catch (err) {
        logger.error(
          `[Zenith] Action "${actionName}" threw an error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        reportError(err as Error, 'action', { element });
      }

      // BUG-EVT-04: `.once` modifier — attribute را بعد از اولین اجرا حذف کن
      // و cacheهای مربوط به timer را پاکسازی کن تا memory leak نداشته باشیم.
      if (modifiers.includes('once')) {
        for (const attr of Array.from(element.attributes)) {
          if (!attr.name.startsWith(ZEN_ACTION_PREFIX)) continue;
          const bindingPart = attr.name.slice(ZEN_ACTION_PREFIX.length);
          const { eventName: boundEvent } = parseBinding(bindingPart);
          if (boundEvent === eventName && attr.value === binding.actionName) {
            element.removeAttribute(attr.name);
            break;
          }
        }
        if (
          eventName === 'click' &&
          element.getAttribute('zen-action') === binding.actionName &&
          !element.getAttribute('zen-action:click')
        ) {
          element.removeAttribute('zen-action');
        }
        // BUG-EVT-04: invalidate binding cache چون attribute تغییر کرد.
        _bindingCache.delete(element);
        // BUG-EVT-04: پاکسازی timed handler cache برای جلوگیری از memory leak
        if (timedHandlerCache.has(element)) {
          const cached = timedHandlerCache.get(element);
          if (cached) {
            for (const [, wrapper] of cached) {
              try {
                wrapper.cancel();
              } catch {
                /* ignore */
              }
            }
            cached.clear();
          }
          timedHandlerCache.delete(element);
        }
      }

      // ── فاز ۷: flushSync بعد از اجرای اکشن ──
      flushSync();
    };

    // FIX (v1.2.7): wire applyTimingModifiers for .debounce / .throttle.
    const hasTiming = modifiers.includes('debounce') || modifiers.includes('throttle');
    if (hasTiming) {
      const cacheKey = `${eventName}:${actionName}`;
      let elementCache = timedHandlerCache.get(element);
      if (!elementCache) {
        elementCache = new Map();
        timedHandlerCache.set(element, elementCache);
      }
      let wrapped = elementCache.get(cacheKey);
      if (!wrapped) {
        wrapped = applyTimingModifiers(invokeAction, modifiers);
        elementCache.set(cacheKey, wrapped);
      }
      wrapped(event);
    } else {
      invokeAction(event);
    }
  } else {
    logger.warn(`[Zenith] Action "${actionName}" is not registered.`);
  }
}
