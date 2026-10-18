// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { processVirtualList } from '../src';
afterEach(() => { vi.unstubAllGlobals(); });
it('keeps the SSR wrapper on inherited unknown item contexts without requiring a writable erased Signal', () => {
  const element = document.createElement('section'); element.innerHTML = '<span>template</span>'; const parent = { $items: [{ id: 1 }, { id: 2 }], payload: { from: 'parent' } }, contexts: Array<Record<string, unknown>> = [], disposes: Array<() => void> = [];
  vi.stubGlobal('document', undefined);
  const controller = processVirtualList(element, '$items', parent, (_node, context) => { contexts.push(context); }, disposes);
  try { expect(contexts.map(context => context.$item)).toEqual(parent.$items); expect(contexts.map(context => context.$index)).toEqual([0, 1]); expect(Object.getPrototypeOf(contexts[0])).toBe(parent); expect(contexts[0]?.payload).toBe(parent.payload); }
  finally { controller.dispose(); for (const dispose of disposes) dispose(); }
});
