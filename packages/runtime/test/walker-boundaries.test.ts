// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { processDOM, walkAndBind, registerCustomDirective, getCustomDirective, type CustomDirectiveHandler } from '../src/walker';
import { clearCustomDirectivesInternal } from '../src/custom-directives';
import type { ZenithRootElement } from '../src/host-types';
const releases: Array<() => void> = [];
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); clearCustomDirectivesInternal(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
function bind(html: string, state: Record<string, unknown>): ZenithRootElement {
  const root = document.createElement('section'); root.innerHTML = html; document.body.append(root); releases.push(processDOM(root, state)); return root;
}
it('retains custom registration identity through the walker facade and uses the selected attribute', () => {
  const captured: unknown[] = [], cleanup = vi.fn();
  const handler: CustomDirectiveHandler = vi.fn((_el: HTMLElement, attr: string | null, context: Record<string, unknown>, state: Record<string, unknown>) => { captured.push(attr, context.$message, state); return cleanup; });
  releases.push(registerCustomDirective('zen-boundary', { handler, attributeName: 'payload' }));
  const state = { message: signal('live') };
  bind('<zen-boundary payload="one"><span zen-text="$message"></span></zen-boundary>', state);
  expect(getCustomDirective('ZEN-BOUNDARY')).toBe(handler); expect(captured).toEqual(['one', 'live', state]);
  // Custom handlers own their subtree; automatic traversal must not bind it again.
  expect(document.querySelector('zen-boundary span')?.textContent).toBe(''); state.message.dispose();
});
it('retains native context inheritance in keyed rows and moves rather than recreates DOM', () => {
  const items = signal([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const root = bind('<ul><li zen-for="item in $items" zen-key="$item.id" zen-bind:data-id="$item.id"><input zen-model="$item.name"></li></ul>', { items });
  const rowA = root.querySelector('[data-id="a"]'), rowB = root.querySelector('[data-id="b"]');
  expect(rowA).not.toBeNull(); expect(rowB).not.toBeNull();
  items.set([{ id: 'b', name: 'B2' }, { id: 'a', name: 'A2' }]); flushSync(); flushSync();
  expect(root.querySelectorAll('li')[0]).toBe(rowB); expect(root.querySelectorAll('li')[1]).toBe(rowA);
  expect(rowA?.querySelector('input')?.value).toBe('A2'); items.dispose();
});
it('keeps if-chain placeholders, branch ownership and teardown after branch switches', () => {
  const first = signal(true), fallback = signal(false), text = signal('one');
  const root = bind('<div zen-if="$first" data-branch="first"><span zen-text="$text"></span></div><div zen-else-if="$fallback" data-branch="second">second</div><div zen-else data-branch="last">last</div>', { first, fallback, text });
  expect(root.querySelector('[data-branch="first"]')).not.toBeNull(); expect(root.querySelector('[data-branch="last"]')).toBeNull();
  first.set(false); flushSync(); expect(root.querySelector('[data-branch="last"]')).not.toBeNull();
  fallback.set(true); flushSync(); expect(root.querySelector('[data-branch="second"]')).not.toBeNull(); expect(root.querySelector('[data-branch="last"]')).toBeNull();
  first.dispose(); fallback.dispose(); text.dispose();
});
it('keeps memo/island child dispatch bound to the same context after extraction', () => {
  const value = signal('visible'), memo = signal(1);
  const root = bind('<div zen-memo="$memo"><b zen-text="$value"></b></div><aside zen-island="load"><i zen-text="$value"></i></aside>', { value, memo });
  window.dispatchEvent(new Event('load')); flushSync();
  expect(root.querySelector('b')?.textContent).toBe('visible'); expect(root.querySelector('i')?.textContent).toBe('visible');
  value.set('updated'); memo.set(2); flushSync(); flushSync(); expect(root.querySelector('b')?.textContent).toBe('updated');
  value.dispose(); memo.dispose();
});
it('keeps best-effort devtools failures from interrupting value binding', () => {
  const previous = Reflect.get(window, '__ZENITH__'), addDirective = vi.fn();
  Reflect.set(window, '__ZENITH__', { addDirective });
  try {
    const root = bind('<b zen-text="$value"></b>', { value: 'bound' });
    expect(root.textContent).toBe('bound'); expect(addDirective).toHaveBeenCalled();
  } finally { if (previous === undefined) Reflect.deleteProperty(window, '__ZENITH__'); else Reflect.set(window, '__ZENITH__', previous); }
});
it('keeps walkAndBind clone cleanup local without assigning root ownership markers', () => {
  const value = signal('one'), root: ZenithRootElement = document.createElement('div'); root.innerHTML = '<b zen-text="$value"></b>';
  const stop = walkAndBind(root, { value }); releases.push(stop);
  expect(root.__zenithDisposes).toBeUndefined(); expect(root.textContent).toBe('one'); stop();
  value.set('two'); flushSync(); expect(root.textContent).toBe('one'); value.dispose();
});
