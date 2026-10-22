// packages/events/src/binding-cache.ts
//
// binding-cache و یافتن binding/عنصر اکشن — استخراج مکانیکی از delegation.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { parseBinding } from './modifier-parse';
import { parseActionCall, type ParsedActionCall } from './action-parse';


/**
 * نتیجه‌ی جستجوی binding روی یک عنصر.
 */
export interface BindingMatch {
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
export const ZEN_ACTION_PREFIX = 'zen-action:';

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
export function computeBindingSignature(el: HTMLElement): string {
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
/**
 * #136: which root listener is dispatching. `.capture` bindings are handled by the capture-phase
 * listener (before descendants' own listeners), every other binding by the bubble-phase one;
 * non-bubbling events (scroll) use a single capture listener for both (`any`).
 */
export type DelegationPhase = 'capture' | 'bubble' | 'any';

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
export let _bindingCache = new WeakMap<HTMLElement, CachedBinding>();

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
export function findBinding(
  el: HTMLElement,
  eventName: string,
  phase: DelegationPhase = 'any',
): BindingMatch | null {
  // ── FEATURE (v1.3.0): Binding Cache lookup ──
  const sig = computeBindingSignature(el);
  let cached = _bindingCache.get(el);
  if (!cached || cached.signature !== sig) {
    cached = { signature: sig, byEvent: new Map() };
    _bindingCache.set(el, cached);
  }
  const cacheKey = phase === 'any' ? eventName : `${eventName}|${phase}`;
  if (cached.byEvent.has(cacheKey)) {
    return cached.byEvent.get(cacheKey) ?? null;
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
        // #136: `.capture` bindings run in the root's capture listener, all others in the bubble one.
        if (phase !== 'any' && modifiers.includes('capture') !== (phase === 'capture')) continue;
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
  if (!result && eventName === 'click' && phase !== 'capture') {
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

  cached.byEvent.set(cacheKey, result);
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
export function findClosestActionElement(
  target: Element,
  eventName: string,
  root: Document | ShadowRoot | HTMLElement = document,
  phase: DelegationPhase = 'any',
): HTMLElement | null {
  let current: Element | null = target;
  while (current && current instanceof HTMLElement) {
    // zen-action="..." (click only) or zen-action:<event>[.modifiers]="..." for this phase
    if (findBinding(current, eventName, phase)) return current;

    // FEATURE (v1.3.0): stop در مرز root.
    // اگر current خود root HTMLElement است، نباید بالاتر برویم.
    if (current === root) {
      return null;
    }
    current = current.parentElement;
  }
  return null;
}