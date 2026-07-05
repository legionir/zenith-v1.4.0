// packages/runtime/src/hydrate.ts
//
// FEATURE (v1.2.0): Hydration Engine.
//
// Provides directive-level hydration helpers that operate on already-rendered
// DOM nodes (typically produced by SSR) rather than rebuilding them from
// scratch.
import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTML, sanitizeHTMLTrusted } from '@zenith/security';
/**
 * Build a context object from the given state.
 */
function buildContext(state) {
    const ctx = {};
    for (const key of Object.keys(state)) {
        const value = state[key];
        ctx[key] = value;
        Object.defineProperty(ctx, `$${key}`, {
            get() {
                if (value && typeof value.get === 'function')
                    return value.get();
                return value;
            },
            configurable: true,
            enumerable: true,
        });
    }
    return ctx;
}
/**
 * Create a hydrator bound to the given root and state.
 */
export function createHydrator(root, state) {
    const disposes = [];
    return {
        root,
        state,
        context: () => buildContext(state),
        hydrateAll() {
            const ctx = buildContext(state);
            const elements = typeof root.querySelectorAll === 'function'
                ? Array.from(root.querySelectorAll('*'))
                : [];
            for (const el of elements) {
                if (el.hasAttribute('zen-text')) {
                    disposes.push(hydrateText(el, el.getAttribute('zen-text'), ctx));
                }
                else if (el.hasAttribute('zen-html-trusted')) {
                    disposes.push(hydrateHtmlTrusted(el, el.getAttribute('zen-html-trusted'), ctx));
                }
                else if (el.hasAttribute('zen-html')) {
                    disposes.push(hydrateHtml(el, el.getAttribute('zen-html'), ctx));
                }
                if (el.hasAttribute('zen-show')) {
                    disposes.push(hydrateShow(el, el.getAttribute('zen-show'), ctx));
                }
                if (el.hasAttribute('zen-if')) {
                    disposes.push(hydrateIf(el, el.getAttribute('zen-if'), ctx));
                }
                if (el.hasAttribute('zen-model')) {
                    disposes.push(hydrateModel(el, el.getAttribute('zen-model'), ctx, state));
                }
                for (const attr of Array.from(el.attributes)) {
                    if (attr.name.startsWith('zen-bind:')) {
                        const attrName = attr.name.slice('zen-bind:'.length);
                        disposes.push(hydrateBind(el, attrName, attr.value, ctx));
                    }
                }
            }
            return () => {
                for (const d of disposes) {
                    try { d(); } catch { /* noop */ }
                }
                disposes.length = 0;
            };
        },
        dispose() {
            for (const d of disposes) {
                try { d(); } catch { /* noop */ }
            }
            disposes.length = 0;
        },
    };
}
/**
 * Hydrate a `zen-text` directive on an existing element.
 */
export function hydrateText(el, expr, context) {
    return hydrateTextExpr(el, compileExpression(expr), context);
}
/**
 * Pre-compiled variant of `hydrateText`.
 */
export function hydrateTextExpr(el, evalFn, context) {
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        const text = value === null || value === undefined ? '' : String(value);
        if (el.textContent !== text) {
            el.textContent = text;
        }
    });
}
/**
 * Hydrate a `zen-html` directive with sanitization.
 */
export function hydrateHtml(el, expr, context) {
    return hydrateHtmlExpr(el, compileExpression(expr), context);
}
/**
 * Pre-compiled variant of `hydrateHtml`.
 */
export function hydrateHtmlExpr(el, evalFn, context) {
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        const html = value === null || value === undefined ? '' : String(value);
        const safe = typeof sanitizeHTML === 'function' ? sanitizeHTML(html) : html;
        if (el.innerHTML !== safe) {
            el.innerHTML = safe;
        }
    });
}
/**
 * Hydrate a `zen-html-trusted` directive (no sanitization).
 */
export function hydrateHtmlTrusted(el, expr, context) {
    const evalFn = compileExpression(expr);
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        const html = value === null || value === undefined ? '' : String(value);
        const safe = typeof sanitizeHTMLTrusted === 'function' ? sanitizeHTMLTrusted(html) : html;
        if (el.innerHTML !== safe) {
            el.innerHTML = safe;
        }
    });
}
/**
 * Hydrate a `zen-show` directive.
 */
export function hydrateShow(el, expr, context) {
    return hydrateShowExpr(el, compileExpression(expr), context);
}
/**
 * Pre-compiled variant of `hydrateShow`.
 */
export function hydrateShowExpr(el, evalFn, context) {
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        el.style.display = value ? '' : 'none';
    });
}
/**
 * Hydrate a `zen-if` directive (toggles display to preserve SSR markup).
 */
export function hydrateIf(el, expr, context) {
    const evalFn = compileExpression(expr);
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        el.style.display = value ? '' : 'none';
    });
}
/**
 * Hydrate a `zen-bind:<attr>` directive.
 */
export function hydrateBind(el, attrName, expr, context) {
    return hydrateBindExpr(el, attrName, compileExpression(expr), context);
}
/**
 * Pre-compiled variant of `hydrateBind`.
 */
export function hydrateBindExpr(el, attrName, evalFn, context) {
    return effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch {
            return;
        }
        const str = value === null || value === undefined || value === false
            ? ''
            : String(value);
        if (str === '' || value === false) {
            if (el.hasAttribute(attrName))
                el.removeAttribute(attrName);
        }
        else {
            if (el.getAttribute(attrName) !== str)
                el.setAttribute(attrName, str);
        }
    });
}
/**
 * Hydrate a `zen-model` directive for two-way binding.
 */
export function hydrateModel(el, expr, context, state) {
    const key = expr.startsWith('$') ? expr.slice(1) : expr;
    const signal = state[key];
    if (!signal || typeof signal.get !== 'function' || typeof signal.set !== 'function') {
        return () => { };
    }
    const input = el;
    const update = () => {
        const v = signal.get();
        if (input.value !== String(v))
            input.value = String(v);
    };
    update();
    const dispose = effect(update);
    const onInput = () => signal.set(input.value);
    el.addEventListener('input', onInput);
    return () => {
        dispose();
        el.removeEventListener('input', onInput);
    };
}
/**
 * Detect whether the given root contains SSR hydration markers.
 */
export function hasHydrationMarkers(root) {
    if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
        return false;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    let node;
    while ((node = walker.nextNode()) !== null) {
        const data = node.data || '';
        if (data.trim().startsWith('zenith-ssr:'))
            return true;
    }
    return false;
}
/**
 * Count the number of SSR hydration markers under the given root.
 */
export function countHydrationMarkers(root) {
    if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
        return 0;
    }
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    let node;
    while ((node = walker.nextNode()) !== null) {
        const data = node.data || '';
        if (data.trim().startsWith('zenith-ssr:'))
            count++;
    }
    return count;
}
//# sourceMappingURL=hydrate.js.map
