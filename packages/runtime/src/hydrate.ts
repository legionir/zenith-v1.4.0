// packages/runtime/src/hydrate.ts
//
// FEATURE (v1.2.0): Hydration Engine.
//
// Provides directive-level hydration helpers that operate on already-rendered
// DOM nodes (typically produced by SSR) rather than rebuilding them from
// scratch. Each helper attaches a reactive effect to an existing element
// without rewriting its children, eliminating the flicker that comes from
// `innerHTML` rewrites during hydration.
//
// Public API (all named exports):
//   - createHydrator(root, state): returns a Hydrator bound to a root + state.
//   - hydrateText(el, expr, context): bind text content reactively.
//   - hydrateTextExpr(el, evalFn, context): pre-compiled variant.
//   - hydrateHtml(el, expr, context): bind sanitized HTML reactively.
//   - hydrateHtmlExpr(el, evalFn, context): pre-compiled variant.
//   - hydrateHtmlTrusted(el, expr, context): bind trusted HTML reactively.
//   - hydrateShow(el, expr, context): toggle display reactively.
//   - hydrateShowExpr(el, evalFn, context): pre-compiled variant.
//   - hydrateIf(el, expr, context): toggle mount/unmount reactively.
//   - hydrateBind(el, attrName, expr, context): bind an attribute reactively.
//   - hydrateBindExpr(el, attrName, evalFn, context): pre-compiled variant.
//   - hydrateModel(el, expr, context, state): two-way binding hydration.
//   - hasHydrationMarkers(root): detect SSR hydration markers.
//   - countHydrationMarkers(root): count SSR hydration markers.
//   - Hydrator (interface): the shape returned by createHydrator.
//
// SSR safety:
//   - All functions are no-ops when `effect` cannot subscribe (e.g. SSR),
//     and DOM mutations are guarded with `typeof document` checks where
//     needed. The helpers themselves are safe to call from server code —
//     they simply short-circuit.

import { effect } from '@zenith/state';

type DisposeFn = () => void;
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTML, sanitizeHTMLTrusted } from '@zenith/security';

/**
 * A compiled expression evaluator. Re-exported here so callers can build
 * pre-compiled hydrators without depending on `@zenith/expressions` directly.
 */
export type CompiledExpr = (context: Record<string, any>) => any;

/**
 * The shape of a hydrator bound to a specific root element and state object.
 */
export interface Hydrator {
  /** The root element this hydrator is bound to. */
  root: HTMLElement;
  /** The state object (Signal-bearing) this hydrator reads from. */
  state: Record<string, any>;
  /** Build a context from state (mirrors createContext from context.ts). */
  context(): Record<string, any>;
  /** Hydrate every supported directive inside the root in one pass. */
  hydrateAll(): DisposeFn;
  /** Dispose every effect created by this hydrator. */
  dispose(): void;
}

/**
 * Build a context object from the given state. Mirrors the behavior of
 * `createContext` in `./context.ts` but is duplicated here so that the
 * hydration engine is self-contained and does not create a circular import.
 *
 * For each key in `state`, the context exposes:
 *   - `$<key>`  → getter that calls `state[key].get()` if it's a Signal,
 *                 otherwise returns the raw value.
 *   - `<key>`   → the raw value (Signal or plain).
 */
function buildContext(state: Record<string, any>): Record<string, any> {
  const ctx: Record<string, any> = {};
  for (const key of Object.keys(state)) {
    const value = state[key];
    // Always expose the raw value under the bare key.
    ctx[key] = value;
    // Expose a `$key` getter that unwraps Signals.
    Object.defineProperty(ctx, `$${key}`, {
      get() {
        if (value && typeof value.get === 'function') return value.get();
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
 *
 * @example
 *   const hydrator = createHydrator(root, state);
 *   const dispose = hydrator.hydrateAll();
 *   // ...later
 *   dispose();
 */
export function createHydrator(
  root: HTMLElement,
  state: Record<string, any>,
): Hydrator {
  const disposes: DisposeFn[] = [];
  return {
    root,
    state,
    context: () => buildContext(state),
    hydrateAll(): DisposeFn {
      const ctx = buildContext(state);
      // Walk all descendant elements and hydrate each known directive.
      const elements = typeof root.querySelectorAll === 'function'
        ? Array.from(root.querySelectorAll('*')) as HTMLElement[]
        : [];
      for (const el of elements) {
        if (el.hasAttribute('zen-text')) {
          disposes.push(hydrateText(el, el.getAttribute('zen-text')!, ctx));
        } else if (el.hasAttribute('zen-html-trusted')) {
          disposes.push(hydrateHtmlTrusted(el, el.getAttribute('zen-html-trusted')!, ctx));
        } else if (el.hasAttribute('zen-html')) {
          disposes.push(hydrateHtml(el, el.getAttribute('zen-html')!, ctx));
        }
        if (el.hasAttribute('zen-show')) {
          disposes.push(hydrateShow(el, el.getAttribute('zen-show')!, ctx));
        }
        if (el.hasAttribute('zen-if')) {
          disposes.push(hydrateIf(el, el.getAttribute('zen-if')!, ctx));
        }
        if (el.hasAttribute('zen-model')) {
          disposes.push(hydrateModel(el, el.getAttribute('zen-model')!, ctx, state));
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
    dispose(): void {
      for (const d of disposes) {
        try { d(); } catch { /* noop */ }
      }
      disposes.length = 0;
    },
  };
}

/**
 * Hydrate a `zen-text` directive on an existing element. The element's
 * text content is updated reactively without rebuilding it.
 */
export function hydrateText(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  return hydrateTextExpr(el, compileExpression(expr), context);
}

/**
 * Pre-compiled variant of `hydrateText`.
 */
export function hydrateTextExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, any>,
): DisposeFn {
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
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
export function hydrateHtml(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  return hydrateHtmlExpr(el, compileExpression(expr), context);
}

/**
 * Pre-compiled variant of `hydrateHtml`.
 */
export function hydrateHtmlExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, any>,
): DisposeFn {
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
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
export function hydrateHtmlTrusted(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  const evalFn = compileExpression(expr);
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
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
 * Hydrate a `zen-show` directive. Toggles `display` reactively without
 * removing the element from the DOM (essential for hydration).
 */
export function hydrateShow(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  return hydrateShowExpr(el, compileExpression(expr), context);
}

/**
 * Pre-compiled variant of `hydrateShow`.
 */
export function hydrateShowExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, any>,
): DisposeFn {
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    el.style.display = value ? '' : 'none';
  });
}

/**
 * Hydrate a `zen-if` directive. Note: full mount/unmount of children is
 * not safe during hydration (it would discard SSR-rendered content). Instead,
 * this helper toggles `display` so the SSR markup is preserved.
 */
export function hydrateIf(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  const evalFn = compileExpression(expr);
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    el.style.display = value ? '' : 'none';
  });
}

/**
 * Hydrate a `zen-bind:<attr>` directive.
 */
export function hydrateBind(
  el: HTMLElement,
  attrName: string,
  expr: string,
  context: Record<string, any>,
): DisposeFn {
  return hydrateBindExpr(el, attrName, compileExpression(expr), context);
}

/**
 * Pre-compiled variant of `hydrateBind`.
 */
export function hydrateBindExpr(
  el: HTMLElement,
  attrName: string,
  evalFn: CompiledExpr,
  context: Record<string, any>,
): DisposeFn {
  return effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    const str = value === null || value === undefined || value === false
      ? ''
      : String(value);
    if (str === '' || value === false) {
      if (el.hasAttribute(attrName)) el.removeAttribute(attrName);
    } else {
      if (el.getAttribute(attrName) !== str) el.setAttribute(attrName, str);
    }
  });
}

/**
 * Hydrate a `zen-model` directive for two-way binding. Reads the signal
 * from `state` via `expr` (e.g. `$name` resolves to `state.name`).
 */
export function hydrateModel(
  el: HTMLElement,
  expr: string,
  // Part of the hydration signature; the model binding resolves from `state`.
  _context: Record<string, any>,
  state: Record<string, any>,
): DisposeFn {
  // Resolve the target signal. `expr` typically starts with `$`.
  const key = expr.startsWith('$') ? expr.slice(1) : expr;
  const signal = state[key];
  if (!signal || typeof signal.get !== 'function' || typeof signal.set !== 'function') {
    return () => {};
  }

  // Initial sync from signal to element.
  const input = el as HTMLInputElement;
  const update = () => {
    const v = signal.get();
    if (input.value !== String(v)) input.value = String(v);
  };
  update();

  // Reactive subscription via effect.
  const dispose = effect(update);

  // Listen for user input and push back to the signal.
  const onInput = () => signal.set(input.value);
  el.addEventListener('input', onInput);
  return () => {
    dispose();
    el.removeEventListener('input', onInput);
  };
}

/**
 * Detect whether the given root contains SSR hydration markers (comment
 * nodes emitted by the SSR layer).
 */
export function hasHydrationMarkers(root: HTMLElement): boolean {
  if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
    return false;
  }
  // SSR markers are emitted as HTML comments; we use a TreeWalker to find
  // any comment whose data starts with `zenith-ssr:`.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const data = (node as Comment).data || '';
    if (data.trim().startsWith('zenith-ssr:')) return true;
  }
  return false;
}

/**
 * Count the number of SSR hydration markers under the given root.
 */
export function countHydrationMarkers(root: HTMLElement): number {
  if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
    return 0;
  }
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const data = (node as Comment).data || '';
    if (data.trim().startsWith('zenith-ssr:')) count++;
  }
  return count;
}
