// packages/events/src/delegation.ts
//
// موتور اصلی Event Delegation — قلب فاز ۴.
//
// FEATURE (v1.3.0):
//   - Custom root: `initEventDelegation(state, { root })` قبول می‌کند
//     Document | ShadowRoot | HTMLElement.
//   - Binding Cache: WeakMap<HTMLElement, CachedBinding> که نتیجه‌ی parse را cache می‌کند.
//   - Parameterized Actions: `zen-action="save($item, $product.id)"`.
import { getAction } from '@zenith/actions';
import { flushSync } from '@zenith/scheduler';
import { navigate } from '@zenith/router';
import { setCurrentPriority } from '@zenith/state';
import { reportError } from '@zenith/error-boundary';
import { evaluateExpression } from '@zenith/expressions';
import { parseBinding, checkKeyboardModifiers, applyBehaviorModifiers, DELEGATED_EVENTS, } from './modifiers.js';
import { applyTimingModifiers } from './timing-modifiers.js';
/**
 * پیشوند نام attribute برای binding های صریح رویداد.
 */
const ZEN_ACTION_PREFIX = 'zen-action:';
/**
 * FEATURE (v1.3.0): تقسیم آرگومان‌های یک Action Call با احترام به nesting.
 */
function splitActionArgs(argsStr) {
    const args = [];
    let depth = 0;
    let inString = null;
    let start = 0;
    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i];
        if (inString) {
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
        }
        else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
        }
        else if (ch === ',' && depth === 0) {
            const arg = argsStr.slice(start, i).trim();
            if (arg.length > 0)
                args.push(arg);
            start = i + 1;
        }
    }
    const last = argsStr.slice(start).trim();
    if (last.length > 0)
        args.push(last);
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
 */
function parseActionCall(actionAttr) {
    const trimmed = actionAttr.trim();
    const openParen = trimmed.indexOf('(');
    if (openParen === -1) {
        return { name: trimmed, argExprs: null };
    }
    const name = trimmed.slice(0, openParen).trim();
    if (!name) {
        return { name: trimmed, argExprs: null };
    }
    const closeParen = trimmed.lastIndexOf(')');
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
 * اگر state item یک signal باشد (duck typing: get + set)، به یک getter تبدیل
 * می‌شود که signal.get() را صدا می‌زند.
 */
function createContextForEval(state) {
    const context = {};
    for (const key in state) {
        const ctxKey = key.startsWith('$') ? key : `$${key}`;
        const item = state[key];
        if (item !== null &&
            typeof item === 'object' &&
            typeof item.get === 'function' &&
            typeof item.set === 'function') {
            Object.defineProperty(context, ctxKey, {
                get: () => item.get(),
                enumerable: true,
                configurable: true,
            });
        }
        else {
            context[ctxKey] = item;
        }
    }
    return context;
}
/**
 * FEATURE (v1.3.0): محاسبه‌ی signature یک element از نظر attribute های zen-action.
 */
function computeBindingSignature(el) {
    const parts = [];
    for (const attr of Array.from(el.attributes)) {
        if (attr.name === 'zen-action' || attr.name.startsWith(ZEN_ACTION_PREFIX)) {
            parts.push(`${attr.name}=${attr.value}`);
        }
    }
    return parts.join('|');
}
/**
 * FEATURE (v1.3.0): Binding Cache — WeakMap<HTMLElement, CachedBinding>.
 */
const _bindingCache = new WeakMap();
export function clearBindingCache() {
    // WeakMap متد clear ندارد. Cache خودش با تغییر signature invalidate می‌شود.
    // این تابع برای completeness API ارائه شده است.
}
/**
 * یافتن binding منطبق با رویداد داده‌شده روی یک عنصر.
 *
 * FEATURE (v1.3.0): از Binding Cache استفاده می‌کند.
 */
function findBinding(el, eventName) {
    const sig = computeBindingSignature(el);
    let cached = _bindingCache.get(el);
    if (!cached || cached.signature !== sig) {
        cached = { signature: sig, byEvent: new Map() };
        _bindingCache.set(el, cached);
    }
    if (cached.byEvent.has(eventName)) {
        return cached.byEvent.get(eventName) ?? null;
    }
    let result = null;
    // ۱. جستجوی binding صریح در attributes
    for (const attr of Array.from(el.attributes)) {
        const name = attr.name;
        if (name.startsWith(ZEN_ACTION_PREFIX)) {
            const bindingPart = name.slice(ZEN_ACTION_PREFIX.length);
            const { eventName: boundEvent, modifiers } = parseBinding(bindingPart);
            if (boundEvent === eventName) {
                const actionName = attr.value;
                if (!actionName)
                    continue;
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
 * پیدا کردن نزدیک‌ترین عنصر در زنجیره‌ی parent که zen-action دارد.
 *
 * FEATURE (v1.3.0): پارامتر `root` برای stop کردن walk در مرز root.
 */
function findClosestActionElement(target, eventName, root = document) {
    let current = target;
    while (current && current instanceof HTMLElement) {
        if (eventName === 'click' && current.hasAttribute('zen-action')) {
            return current;
        }
        for (const attr of Array.from(current.attributes)) {
            if (!attr.name.startsWith(ZEN_ACTION_PREFIX))
                continue;
            const bindingPart = attr.name.slice(ZEN_ACTION_PREFIX.length);
            const boundEvent = bindingPart.split('.', 1)[0];
            if (boundEvent === eventName) {
                return current;
            }
        }
        // FEATURE (v1.3.0): stop در مرز root.
        if (current === root) {
            return null;
        }
        current = current.parentElement;
    }
    return null;
}
/**
 * پردازش یک رویداد delegate‌شده.
 *
 * FEATURE (v1.3.0): پشتیبانی از Parameterized Actions.
 */
function delegateEvent(event, state, eventName, timedHandlerCache, root) {
    const target = event.target;
    if (!(target instanceof Element))
        return;
    // ── فاز ۸: zen-link (تقدم بر zen-action برای click) ──
    if (eventName === 'click') {
        const linkEl = target.closest('[zen-link]');
        if (linkEl) {
            event.preventDefault();
            const path = linkEl.getAttribute('zen-link') || linkEl.getAttribute('href');
            if (path) {
                navigate(path);
                flushSync();
            }
            else {
                console.warn('[Zenith] <a zen-link> has no path (neither zen-link nor href attribute).');
            }
            return;
        }
    }
    const matched = findClosestActionElement(target, eventName, root);
    if (!matched)
        return;
    const binding = findBinding(matched, eventName);
    if (!binding)
        return;
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
        const invokeAction = (ev) => {
            // FEATURE (v1.3.0): ارزیابی آرگومان‌های Parameterized Action.
            let args;
            if (parsed.argExprs) {
                try {
                    const ctx = createContextForEval(state);
                    args = parsed.argExprs.map((expr) => evaluateExpression(expr, ctx));
                }
                catch (err) {
                    console.error(`[Zenith] Failed to evaluate args for action "${actionName}":`, err);
                    reportError(err, 'action', { element });
                    flushSync();
                    return;
                }
            }
            try {
                const result = actionFn({ event: ev, state, element, args });
                if (result && typeof result.catch === 'function') {
                    result.catch((err) => {
                        console.error(`[Zenith] Async action "${actionName}" threw an error:`, err);
                        reportError(err, 'action', { element });
                        flushSync();
                    });
                }
            }
            catch (err) {
                console.error(`[Zenith] Action "${actionName}" threw an error:`, err);
                reportError(err, 'action', { element });
            }
            // `.once` modifier — attribute را بعد از اولین اجرا حذف کن.
            if (modifiers.includes('once')) {
                for (const attr of Array.from(element.attributes)) {
                    if (!attr.name.startsWith(ZEN_ACTION_PREFIX))
                        continue;
                    const bindingPart = attr.name.slice(ZEN_ACTION_PREFIX.length);
                    const { eventName: boundEvent } = parseBinding(bindingPart);
                    if (boundEvent === eventName && attr.value === binding.actionName) {
                        element.removeAttribute(attr.name);
                        break;
                    }
                }
                if (eventName === 'click' && element.getAttribute('zen-action') === binding.actionName && !element.getAttribute(`zen-action:click`)) {
                    element.removeAttribute('zen-action');
                }
                // FEATURE (v1.3.0): invalidate binding cache چون attribute تغییر کرد.
                _bindingCache.delete(element);
            }
            // ── فاز ۷: flushSync بعد از اجرای اکشن ──
            flushSync();
        };
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
        }
        else {
            invokeAction(event);
        }
    }
    else {
        console.warn(`[Zenith] Action "${actionName}" is not registered.`);
    }
}
/**
 * FEATURE (v1.3.0): مقداردهی اولیه‌ی Event Delegation روی `root`.
 *
 * @param state   آبجکت State کاربر.
 * @param options FEATURE (v1.3.0): `{ root }` برای custom delegation root.
 * @returns تابع teardown برای حذف تمام Listenerها.
 */
export function initEventDelegation(state, options) {
    // FEATURE (v1.3.0): Custom root.
    const root = options?.root ?? document;
    const listeners = [];
    const timedHandlerCache = new Map();
    for (const eventName of DELEGATED_EVENTS) {
        const handler = (event) => {
            const oldPriority = setCurrentPriority('urgent');
            try {
                delegateEvent(event, state, eventName, timedHandlerCache, root);
            }
            finally {
                setCurrentPriority(oldPriority);
            }
        };
        root.addEventListener(eventName, handler, false);
        listeners.push({ name: eventName, handler });
    }
    return function teardown() {
        for (const { name, handler } of listeners) {
            root.removeEventListener(name, handler, false);
        }
        listeners.length = 0;
        for (const elementCache of timedHandlerCache.values()) {
            for (const wrapped of elementCache.values()) {
                try { wrapped.cancel(); } catch { /* ignore */ }
            }
            elementCache.clear();
        }
        timedHandlerCache.clear();
    };
}
//# sourceMappingURL=delegation.js.map
