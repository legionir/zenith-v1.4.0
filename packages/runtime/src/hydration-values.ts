import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTML, sanitizeHTMLTrusted } from '@zenith/security';
import type { CompiledExpr, DisposeFn } from './hydration-types';

/** Attach the existing hydrateText binding without rebuilding the subtree. @public */
export function hydrateText(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
): DisposeFn {
  return hydrateTextExpr(el, compileExpression(expr), context);
}

/** Attach the existing hydrateTextExpr binding without rebuilding the subtree. @public */
export function hydrateTextExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, unknown>,
): DisposeFn {
  return effect(() => {
    let value: unknown;
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

/** Attach the existing hydrateHtml binding without rebuilding the subtree. @public */
export function hydrateHtml(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
): DisposeFn {
  return hydrateHtmlExpr(el, compileExpression(expr), context);
}

/** Attach the existing hydrateHtmlExpr binding without rebuilding the subtree. @public */
export function hydrateHtmlExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, unknown>,
): DisposeFn {
  return effect(() => {
    let value: unknown;
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

/** Attach the existing hydrateHtmlTrusted binding without rebuilding the subtree. @public */
export function hydrateHtmlTrusted(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
): DisposeFn {
  const evalFn = compileExpression(expr);
  return effect(() => {
    let value: unknown;
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

/** Attach the existing hydrateShow binding without rebuilding the subtree. @public */
export function hydrateShow(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
): DisposeFn {
  return hydrateShowExpr(el, compileExpression(expr), context);
}

/** Attach the existing hydrateShowExpr binding without rebuilding the subtree. @public */
export function hydrateShowExpr(
  el: HTMLElement,
  evalFn: CompiledExpr,
  context: Record<string, unknown>,
): DisposeFn {
  return effect(() => {
    let value: unknown;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    el.style.display = value ? '' : 'none';
  });
}

/** Attach the existing hydrateIf binding without rebuilding the subtree. @public */
export function hydrateIf(el: HTMLElement, expr: string, context: Record<string, unknown>): DisposeFn {
  const evalFn = compileExpression(expr);
  return effect(() => {
    let value: unknown;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    el.style.display = value ? '' : 'none';
  });
}

/** Attach the existing hydrateBind binding without rebuilding the subtree. @public */
export function hydrateBind(
  el: HTMLElement,
  attrName: string,
  expr: string,
  context: Record<string, unknown>,
): DisposeFn {
  return hydrateBindExpr(el, attrName, compileExpression(expr), context);
}

/** Attach the existing hydrateBindExpr binding without rebuilding the subtree. @public */
export function hydrateBindExpr(
  el: HTMLElement,
  attrName: string,
  evalFn: CompiledExpr,
  context: Record<string, unknown>,
): DisposeFn {
  return effect(() => {
    let value: unknown;
    try {
      value = evalFn(context);
    } catch {
      return;
    }
    const str = value === null || value === undefined || value === false ? '' : String(value);
    if (str === '' || value === false) {
      if (el.hasAttribute(attrName)) el.removeAttribute(attrName);
    } else {
      if (el.getAttribute(attrName) !== str) el.setAttribute(attrName, str);
    }
  });
}

/** Attach the existing hydrateModel binding without rebuilding the subtree. @public */
export function hydrateModel(
  el: HTMLElement,
  expr: string,
  // Part of the hydration signature; the model binding resolves from `state`.
  _context: Record<string, unknown>,
  state: Record<string, unknown>,
): DisposeFn {
  // Resolve the target signal. `expr` typically starts with `$`.
  const key = expr.startsWith('$') ? expr.slice(1) : expr;
  // Dynamic form binding is the existing runtime-write boundary, not Signal<unknown>.
  const signal = state[key] as { get(): unknown; set(value: unknown): void } | null | undefined;
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
