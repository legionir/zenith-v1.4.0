import { createBindingContext, evaluateExpression } from '@zenith/expressions';
import type { App } from '../types';
import { handleAppError } from '../errors';

export interface MemoMarkedElement extends HTMLElement {
  __zenMemoUnchanged?: boolean;
}

/** انتساب property نامتعارف style بدون any (CSS OM در غیاب تایپ index-based). */
function setStyleProp(el: HTMLElement, prop: string, value: unknown): void {
  (el.style as unknown as Record<string, unknown>)[prop] = value ?? '';
}

export const createEvalContext = createBindingContext;

export function evalExpr(expr: string, ctx: Record<string, unknown>, app: App): unknown {
  try {
    return evaluateExpression(expr, ctx);
  } catch (err) {
    handleAppError(app, err);
    return undefined;
  }
}

export function resolveRawTarget(
  expr: string,
  state: Record<string, unknown>,
  locals: Record<string, unknown>,
): unknown {
  const trimmed = expr.trim().replace(/^\$/, '');
  if (trimmed in locals) return locals[trimmed];
  if (trimmed in state) return state[trimmed];
  return undefined;
}

export function applyAttributeBinding(el: HTMLElement, attr: string, val: unknown): void {
  if (attr === 'class') {
    if (typeof val === 'string') {
      el.className = val;
    } else if (Array.isArray(val)) {
      el.className = val.filter(Boolean).join(' ');
    } else if (val && typeof val === 'object') {
      el.className = Object.entries(val as Record<string, unknown>)
        .filter(([, on]) => Boolean(on))
        .map(([cls]) => cls)
        .join(' ');
    }
    return;
  }
  if (attr === 'style') {
    if (typeof val === 'string') {
      el.setAttribute('style', val);
    } else if (val && typeof val === 'object') {
      for (const [prop, styleVal] of Object.entries(val as Record<string, unknown>)) {
        setStyleProp(el, prop, styleVal);
      }
    }
    return;
  }
  if (attr === 'value' && 'value' in el) {
    (el as HTMLInputElement).value = val === undefined || val === null ? '' : String(val);
    return;
  }
  if (attr === 'checked' && 'checked' in el) {
    (el as HTMLInputElement).checked = Boolean(val);
    return;
  }
  if (val === false || val === null || val === undefined) {
    el.removeAttribute(attr);
  } else if (val === true) {
    el.setAttribute(attr, '');
  } else {
    el.setAttribute(attr, String(val));
  }
}

