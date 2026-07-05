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

import { getAction } from '@zenith/actions';
import { flushSync } from '@zenith/scheduler';
import { navigate } from '@zenith/router';
// Bug Fix #2: اولویت urgent برای event handlers.
import { setCurrentPriority } from '@zenith/state';
// FIX (v1.2.7): Action errors now reported to error boundary so a
// zen-error ancestor can show its fallback UI when an action throws.
import { reportError } from '@zenith/error-boundary';
// FEATURE (v1.3.0): Expression Engine برای Parameterized Actions.
// `evaluateExpression` برای ارزیابی آرگومان‌های `save($item, $product.id)`
// استفاده می‌شود. این dependency جدید به `@zenith/events` اضافه شده است.
import { evaluateExpression } from '@zenith/expressions';
import {
  parseBinding,
  checkKeyboardModifiers,
  applyBehaviorModifiers,
  DELEGATED_EVENTS,
  type DelegatedEventName,
} from './modifiers';
// FIX (v1.2.7): applyTimingModifiers — wraps the action invocation with
// .debounce.NNN / .throttle.NNN behavior.
import { applyTimingModifiers, type TimedHandler } from './timing-modifiers';

/**
 * نتیجه‌ی parsing یک Action Call.
 *
 * مثلاً `save($item, $product.id)` تبدیل می‌شود به:
 *   { name: 'save', argExprs: ['$item', '$product.id'] }
 *
 * اگر اکشن بدون parens باشد (`save`):
 *   { name: 'save', argExprs: null }
 *
 * `argExprs === null` یعنی backward-compatible: `ctx.args` برابر `undefined` است.
 * `argExprs === []` یعنی اکشن با parens خالی صدا زده شده (`save()`): `ctx.args = []`.
 */
interface ParsedActionCall {
  name: string;
  argExprs: string[] | null;
}

/**
 * نتیجه‌ی جستجوی binding روی یک عنصر.
 */
interface BindingMatch {
  /** مقدار attribute (مثلاً `save($item)` یا `save`). */
  actionName: string;
  /** نام اکشن و آرگومان‌های parse‌شده. */
  parsed: ParsedActionCall;
  /** لیست modifier ها. */
  modifiers: string[];
  /** عنصری که binding روی آن پیدا شد. */
  element: HTMLElement;
}

/**
 * پیشوند نام attribute برای binding های صریح رویداد.
 */
const ZEN_ACTION_PREFIX = 'zen-action:';

/**
 * FEATURE (v1.3.0): تقسیم آرگومان‌های یک Action Call با احترام به nesting.
 *
 * این تابع یک رشته‌ی `argsStr` می‌گیرد (مثلاً `'$item, $product.id, "hello, world"'`)
 * و آن را به آرایه‌ای از expression string ها تقسیم می‌کند.
 *
 * نکته‌ی مهم: کاما داخل string ها، parentheses، brackets و braces نادیده گرفته
 * می‌شود. مثلاً `foo(a, b), bar([1, 2, 3])` به `['foo(a, b)', 'bar([1, 2, 3])']` تبدیل می‌شود.
 *
 * @param argsStr محتوای داخل پرانتز (مثلاً `'$item, $product.id'`).
 * @returns آرایه‌ای از expression string ها.
 */
function splitActionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let start = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]!;

    if (inString) {
      // escape: کاراکتر بعدی نادیده گرفته می‌شود
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      const arg = argsStr.slice(start, i).trim();
      if (arg.length > 0) args.push(arg);
      start = i + 1;
    }
  }

  // آخرین arg
  const last = argsStr.slice(start).trim();
  if (last.length > 0) args.push(last);

  return args;
}

/**
 * FEATURE (v1.3.0): Parsing یک Action Call string.
 *
 * مثال‌ها:
 *   `save`                  → { name: 'save', argExprs: null }
 *   `save()`                → { name: 'save', argExprs: [] }
 *   `save($item)`           → { name: 'save', argExprs: ['$item'] }
 *   `save($item, $p.id)`    → { name: 'save', argExprs: ['$item', '$p.id'] }
 *   `save($obj.method(a,b))`→ { name: 'save', argExprs: ['$obj.method(a,b)'] }
 *
 * اگر parsing ناموفق باشد (مثلاً پرانتز بسته نشده)، به‌صورت backward-compatible
 * عمل می‌کند و کل رشته را به‌عنوان نام اکشن در نظر می‌گیرد.
 *
 * @param actionAttr مقدار attribute `zen-action` یا `zen-action:<event>`.
 */
function parseActionCall(actionAttr: string): ParsedActionCall {
  const trimmed = actionAttr.trim();
  const openParen = trimmed.indexOf('(');

  // بدون پرانتز → backward compatible
  if (openParen === -1) {
    return { name: trimmed, argExprs: null };
  }

  const name = trimmed.slice(0, openParen).trim();
  // اعتبارسنجی اولیه: نام نباید خالی باشد
  if (!name) {
    return { name: trimmed, argExprs: null };
  }

  const closeParen = trimmed.lastIndexOf(')');
  // پرانتز بسته نشده → backward compatible (کل رشته را به‌عنوان نام بگیر)
  if (closeParen === -1 || closeParen < openParen) {
    return { name: trimmed, argExprs: null };
  }

  const argsStr = trimmed.slice(openParen + 1, closeParen).trim();
  if (!argsStr) {
    return { name, argExprs: [] };
  }

  return { name, argExprs: splitActionArgs(argsStr) };
}

/**
 * FEATURE (v1.3.0): ساخت Context برای Expression Engine از State.
 *
 * این helper یک کپی سبک از منطق `createContext` در `@zenith/runtime` است.
 * ما آن را اینجا inline می‌کنیم تا circular dependency با runtime نداشته باشیم.
 *
 * اگر state item یک signal باشد (duck typing: get + set)، به یک getter تبدیل
 * می‌شود که signal.get() را صدا می‌زند. در غیر این صورت، مستقیماً در context
 * قرار می‌گیرد.
 *
 * نکته: پیشوند `$` به طور خودکار اضافه می‌شود. مثلاً `state.user` (signal)
 * به `context.$user` (getter) تبدیل می‌شود. اگر state از قبل `$` دارد (مثل
 * `state.$product`), همان نام حفظ می‌شود.
 *
 * @param state آبجکت State کاربر.
 * @returns Context قابل استفاده در evaluateExpression.
 */
function createContextForEval(state: Record<string, any>): Record<string, any> {
  const context: Record<string, any> = {};
  for (const key in state) {
    const ctxKey = key.startsWith('$') ? key : `$${key}`;
    const item = state[key];
    if (
      item !== null &&
      typeof item === 'object' &&
      typeof item.get === 'function' &&
      typeof item.set === 'function'
    ) {
      // Signal: به getter تبدیل می‌شود تا در حین ارزیابی unwrap شود.
      Object.defineProperty(context, ctxKey, {
        get: () => item.get(),
        enumerable: true,
        configurable: true,
      });
    } else {
      // مقدار ساده یا Service — مستقیماً در Context.
      context[ctxKey] = item;
    }
  }
  return context;
}

/**
 * FEATURE (v1.3.0): محاسبه‌ی signature یک element از نظر attribute های zen-action.
 *
 * این signature برای invalidating binding cache استفاده می‌شود. اگر signature
 * تغییر کرده باشد (مثلاً attribute اضافه/حذف/تغییر کرده)، cache invalidate می‌شود.
 *
 * signature شامل تمام attribute هایی است که با `zen-action` شروع می‌شوند،
 * به ترتیب DOM، به شکل `name=value|name=value|...`.
 *
 * نکته: `zen-action` ساده هم شامل می‌شود.
 */
function computeBindingSignature(el: HTMLElement): string {
  const parts: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'zen-action' || attr.name.startsWith(ZEN_ACTION_PREFIX)) {
      parts.push(`${attr.name}=${attr.value}`);
    }
  }
  return parts.join('|');
}

/**
 * FEATURE (v1.3.0): Cached binding برای یک element.
 *
 * `signature` برای invalidation استفاده می‌شود. `byEvent` نتیجه‌ی parse
 * را برای هر eventName cache می‌کند (می‌تواند `null` باشد = no binding).
 */
interface CachedBinding {
  signature: string;
  byEvent: Map<string, BindingMatch | null>;
}

/**
 * BUG-EVT-01: Binding Cache — WeakMap<HTMLElement, CachedBinding>.
 *
 * این cache از re-parse شدن `zen-action*` attribute ها در هر رویداد جلوگیری
 * می‌کند. وقتی یک رویداد رخ می‌دهد و همان element دوباره target می‌شود،
 * اگر attribute ها تغییر نکرده باشند، نتیجه‌ی parse از cache برمی‌گردد.
 *
 * WeakMap به‌طور خودکار زمانی که element از DOM حذف و GC شود، پاک می‌شود.
 * پس memory leak نداریم.
 *
 * این cache module-level است و بین تمام `initEventDelegation` instances
 * مشترک است. این امن است چون cache بر اساس (element, signature) کلید‌زده
 * شده و اگر attribute ها تغییر کنند، invalidate می‌شود.
 *
 * NOTE: از `let` استفاده می‌شود تا clearBindingCache بتواند یک WeakMap جدید
 * جایگزین کند. WeakMap متد `clear()` ندارد.
 */
let _bindingCache = new WeakMap<HTMLElement, CachedBinding>();

/**
 * BUG-EVT-01: پاک کردن کل Binding Cache.
 *
 * WeakMap متد `clear()` ندارد، بنابراین یک WeakMap جدید جایگزین می‌کنیم.
 * تمام cacheهای قبلی به مرور توسط GC جمع‌آوری می‌شوند.
 *
 * مفید برای HMR و تست‌ها. در production معمولاً نیاز نیست.
 */
export function clearBindingCache(): void {
  _bindingCache = new WeakMap<HTMLElement, CachedBinding>();
}

/**
 * یافتن binding منطبق با رویداد داده‌شده روی یک عنصر.
 *
 * الگوریتم:
 *   1) signature عنصر را محاسبه کن.
 *   2) اگر cache دارد و signature مطابق است، نتیجه‌ی cache را برگردان.
 *   3) در غیر این صورت، روی attributes بچرخ و binding را پیدا کن.
 *   4) نتیجه را در cache ذخیره کن.
 *
 * @param el        عنصری که target.closest('[zen-action…]') روی آن applica شده.
 * @param eventName نام رویداد فعلی (مثلاً 'click', 'keydown').
 */
function findBinding(el: HTMLElement, eventName: string): BindingMatch | null {
  // ── FEATURE (v1.3.0): Binding Cache lookup ──
  const sig = computeBindingSignature(el);
  let cached = _bindingCache.get(el);
  if (!cached || cached.signature !== sig) {
    cached = { signature: sig, byEvent: new Map() };
    _bindingCache.set(el, cached);
  }
  if (cached.byEvent.has(eventName)) {
    return cached.byEvent.get(eventName) ?? null;
  }

  // ── محاسبه‌ی binding ──
  let result: BindingMatch | null = null;

  // ۱. جستجوی binding صریح در attributes
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    if (name.startsWith(ZEN_ACTION_PREFIX)) {
      const bindingPart = name.slice(ZEN_ACTION_PREFIX.length);
      const { eventName: boundEvent, modifiers } = parseBinding(bindingPart);
      if (boundEvent === eventName) {
        const actionName = attr.value;
        if (!actionName) continue;
        result = {
          actionName,
          parsed: parseActionCall(actionName),
          modifiers,
          element: el,
        };
        break;
      }
    }
  }

  // ۲. شکل پیش‌فرض: zen-action="..." (فقط برای click)
  if (!result && eventName === 'click') {
    const actionName = el.getAttribute('zen-action');
    if (actionName) {
      result = {
        actionName,
        parsed: parseActionCall(actionName),
        modifiers: [],
        element: el,
      };
    }
  }

  cached.byEvent.set(eventName, result);
  return result;
}

/**
 * پیدا کردن نزدیک‌ترین عنصر در زنجیره‌ی parent که zen-action برای رویداد
 * داده‌شده دارد.
 *
 * نمی‌توانیم از `closest()` با CSS selector استفاده کنیم چون:
 *   ۱) `[zen-action]` فقط attribute با نام دقیق `zen-action` را می‌بیند،
 *      نه `zen-action:click` یا `zen-action:keydown.enter`.
 *   ۲) Escape کردن `:` در selector در مرورگرهای مختلف ناسازگار است.
 *
 * راه‌حل: walk دستی روی parentElement و بررسی attributes هر عنصر.
 *
 * FEATURE (v1.3.0): پارامتر `root` برای stop کردن walk در مرز root.
 * این برای Shadow DOM و subtree delegation ضروری است.
 *
 * @param target    عنصر target رویداد.
 * @param eventName نام رویداد فعلی.
 * @param root      ریشه‌ی delegation (Document/ShadowRoot/HTMLElement).
 *                  walk در این مرز متوقف می‌شود.
 * @returns اولین HTMLElement که zen-action برای این رویداد دارد، یا null.
 */
function findClosestActionElement(
  target: Element,
  eventName: string,
  root: Document | ShadowRoot | HTMLElement = document,
): HTMLElement | null {
  let current: Element | null = target;
  while (current && current instanceof HTMLElement) {
    // ── ۱. شکل پیش‌فرض: zen-action="..." (فقط برای click) ──
    if (eventName === 'click' && current.hasAttribute('zen-action')) {
      return current;
    }

    // ── ۲. شکل صریح: zen-action:<eventName> ──
    for (const attr of Array.from(current.attributes)) {
      if (!attr.name.startsWith(ZEN_ACTION_PREFIX)) continue;
      const bindingPart = attr.name.slice(ZEN_ACTION_PREFIX.length);
      const boundEvent = bindingPart.split('.', 1)[0];
      if (boundEvent === eventName) {
        return current;
      }
    }

    // FEATURE (v1.3.0): stop در مرز root.
    // اگر current خود root HTMLElement است، نباید بالاتر برویم.
    if (current === root) {
      return null;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * FIX (v1.2.7): Per-element cache of timed (debounced/throttled) handlers.
 */
type TimedHandlerCache = Map<HTMLElement, Map<string, TimedHandler & { cancel: () => void }>>;

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
function delegateEvent(
  event: Event,
  state: Record<string, any>,
  eventName: DelegatedEventName,
  timedHandlerCache: TimedHandlerCache,
  root: Document | ShadowRoot | HTMLElement,
): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // ── فاز ۸: zen-link (تقدم بر zen-action برای click) ──
  if (eventName === 'click') {
    const linkEl = target.closest<HTMLElement>('[zen-link]');
    if (linkEl) {
      event.preventDefault();
      const path = linkEl.getAttribute('zen-link') || linkEl.getAttribute('href');
      if (path) {
        navigate(path);
        flushSync();
      } else {
        console.warn('[Zenith] <a zen-link> has no path (neither zen-link nor href attribute).');
      }
      return;
    }
  }

  const matched = findClosestActionElement(target, eventName, root);
  if (!matched) return;

  const binding = findBinding(matched, eventName);
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
  const shouldProceed = applyBehaviorModifiers(event, modifiers, element);
  if (!shouldProceed) {
    return;
  }

  // ── ۳. اجرای اکشن ──
  const actionFn = getAction(actionName);
  if (actionFn) {
    const invokeAction = (ev: Event) => {
      // FEATURE (v1.3.0): ارزیابی آرگومان‌های Parameterized Action.
      let args: any[] | undefined;
      if (parsed.argExprs) {
        try {
          const ctx = createContextForEval(state);
          args = parsed.argExprs.map((expr) => evaluateExpression(expr, ctx));
        } catch (err) {
          console.error(
            `[Zenith] Failed to evaluate args for action "${actionName}":`,
            err,
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
            console.error(`[Zenith] Async action "${actionName}" threw an error:`, err);
            reportError(err as Error, 'action', { element });
            flushSync();
          });
        }
      } catch (err) {
        console.error(`[Zenith] Action "${actionName}" threw an error:`, err);
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
              try { wrapper.cancel(); } catch { /* ignore */ }
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
    const hasTiming =
      modifiers.includes('debounce') || modifiers.includes('throttle');
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
    console.warn(`[Zenith] Action "${actionName}" is not registered.`);
  }
}

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
  state: Record<string, any>,
  options?: InitEventDelegationOptions,
): () => void {
  // FEATURE (v1.3.0): Custom root.
  const root: DelegationRoot = options?.root ?? document;

  const listeners: Array<{ name: DelegatedEventName; handler: (e: Event) => void }> = [];
  const timedHandlerCache: TimedHandlerCache = new Map();

  for (const eventName of DELEGATED_EVENTS) {
    const handler = (event: Event) => {
      const oldPriority = setCurrentPriority('urgent');
      try {
        delegateEvent(event, state, eventName, timedHandlerCache, root);
      } finally {
        setCurrentPriority(oldPriority);
      }
    };

    // ثبت روی root. برای HTMLElement هم `addEventListener` وجود دارد.
    root.addEventListener(eventName, handler as EventListener, false);
    listeners.push({ name: eventName, handler });
  }

  return function teardown() {
    for (const { name, handler } of listeners) {
      root.removeEventListener(name, handler as EventListener, false);
    }
    listeners.length = 0;
    // FIX (v1.2.7): cancel pending debounce/throttle timers.
    for (const elementCache of timedHandlerCache.values()) {
      for (const wrapped of elementCache.values()) {
        try { wrapped.cancel(); } catch { /* ignore */ }
      }
      elementCache.clear();
    }
    timedHandlerCache.clear();
  };
}
