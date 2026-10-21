import { effect, untrack } from '@zenith/state';
import { compileExpression, createBindingContext } from '@zenith/expressions';
import { cleanupScope } from './internal';

interface ValueContext { expr: string; context: Record<string, unknown>; state?: Record<string, unknown>; notifyUpdate?(): void; }
/** General expressions are readable; only a directly named writable may be updated. */
export function uiValueBinding(context: ValueContext) {
  const expression = context.expr.trim(); if (!expression) return undefined;
  const read = compileExpression(expression), view = createBindingContext(context.state ?? {}, context.context);
  const direct = /^\$?[A-Za-z_][\w$]*$/.test(expression);
  const rawTarget = () => {
    const state = context.state ?? {}, locals = context.context;
    const find = (key: string) => Object.hasOwn(locals, key) ? { source: locals, key } : Object.hasOwn(state, key) ? { source: state, key } : undefined;
    const found = find(expression) ?? (expression.startsWith('$') ? find(expression.slice(1)) : undefined);
    return found ? Reflect.get(found.source, found.key) as unknown : undefined;
  };
  return {
    read: () => read(view),
    write(value: unknown) {
      if (!direct) return; const target = rawTarget();
      if (!target || (typeof target !== 'object' && typeof target !== 'function')) return;
      const candidate = target as { get?: unknown; set?: unknown };
      if (typeof candidate.get !== 'function' || typeof candidate.set !== 'function') return;
      if (Object.is(candidate.get.call(target), value)) return;
      candidate.set.call(target, value); context.notifyUpdate?.();
    },
  };
}
/** Install both directions as one closed owner; programmatic sync never echoes user events. */
export function bindUIValue(el: HTMLElement, binding: ReturnType<typeof uiValueBinding>, controller: { dispose(): void }, apply: (value: unknown) => void, events: Record<string, (event: Event) => unknown>) {
  const scope = cleanupScope(); scope.add(controller); let syncing = false;
  try {
    if (binding) {
      for (const [name, decode] of Object.entries(events)) {
        const handler = (event: Event) => { if (!scope.disposed && !syncing && event.target === el) { const value = decode(event); if (value !== undefined) binding.write(value); } };
        el.addEventListener(name, handler); scope.add(() => el.removeEventListener(name, handler));
      }
      scope.add(effect(() => { const value = binding.read(); if (scope.disposed) return; syncing = true; try { untrack(() => apply(value)); } finally { syncing = false; } }));
    }
    return { dispose: scope.dispose };
  } catch (error) { try { scope.dispose(); } catch {} throw error; }
}
export function uiEventField(event: Event, key: string): unknown {
  const detail: unknown = (event as CustomEvent<unknown>).detail;
  return detail && typeof detail === 'object' && Object.hasOwn(detail, key) ? Reflect.get(detail, key) as unknown : undefined;
}
/** Field projections are own-property only; no dynamic expression/function evaluation. */
export function uiField(value: unknown, path: string): unknown {
  const parts = path.split('.');
  if (parts.some(part => !/^[A-Za-z_][\w$]*$/.test(part) || ['__proto__', 'constructor', 'prototype'].includes(part))) return undefined;
  let current = value;
  for (const part of parts) { if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined; current = Reflect.get(current, part) as unknown; }
  return current;
}
