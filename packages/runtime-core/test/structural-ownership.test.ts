// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createApp, onMount, onUnmount, provide, inject, useApp, type BindContext } from '../src';
afterEach(() => document.body.replaceChildren());
it('releases removed conditional bindings immediately rather than only at App disposal', () => {
  const visible = signal(true); const removed = vi.fn(); const root = document.createElement('main'); root.innerHTML = '<section zen-if="visible"><button zen-probe>click</button></section>'; document.body.appendChild(root);
  const app = createApp({ state: { visible } }); const click = vi.fn(); app.directive({ name: 'probe', bind(el) { el.addEventListener('click', click); onUnmount(removed); return () => el.removeEventListener('click', click); } });
  app.mount(root); const button = root.querySelector('button')!; button.click(); expect(click).toHaveBeenCalledOnce();
  visible.set(false); flushSync(); expect(removed).toHaveBeenCalledOnce(); button.click(); expect(click).toHaveBeenCalledOnce();
  app.dispose(); expect(removed).toHaveBeenCalledOnce(); visible.dispose();
});
it('owns each for-row subtree and detaches stale listeners when rows change', () => {
  const items = signal([{ id: 1 }]); const root = document.createElement('main'); root.innerHTML = '<button zen-for="item in items" zen-key="item.id" zen-probe>row</button>'; document.body.appendChild(root);
  const removed = vi.fn(), click = vi.fn(); const app = createApp({ state: { items } }); app.directive({ name: 'probe', bind(el) { el.addEventListener('click', click); return () => { removed(); el.removeEventListener('click', click); }; } });
  app.mount(root); const button = root.querySelector('button')!; items.set([{ id: 2 }]); flushSync(); expect(removed).toHaveBeenCalledOnce(); button.click(); expect(click).not.toHaveBeenCalled();
  app.dispose(); expect(removed).toHaveBeenCalledTimes(2); items.dispose();
});
it('ignores delayed processChildren calls after the captured owner has closed', () => {
  let context!: BindContext; const app = createApp(); const probe = vi.fn(); app.directive({ name: 'capture', bind(_el, ctx) { context = ctx; } }); app.directive({ name: 'probe', bind: probe });
  const root = document.createElement('main'); root.setAttribute('zen-capture', ''); document.body.appendChild(root); app.mount(root); app.dispose();
  const child = document.createElement('span'); child.setAttribute('zen-probe', ''); expect(() => context.processChildren(child)()).not.toThrow(); expect(probe).not.toHaveBeenCalled();
});
it('isolates plugin installation from another App\'s active element scope', () => {
  const outer = createApp(), inner = createApp(); const root = document.createElement('main'); root.setAttribute('zen-install', ''); document.body.appendChild(root);
  outer.directive({ name: 'install', bind() { inner.use({ name: 'inner', install(app) { app.provide('owner', 'inner'); } }); } }); outer.mount(root);
  expect(inner.inject('owner')).toBe('inner'); expect(outer.inject('owner')).toBeUndefined(); outer.dispose(); inner.dispose();
});
it('restores structural templates so unmount/remount has exactly one live subtree', () => {
  const root = document.createElement('main'); root.innerHTML = '<p zen-if="show" zen-probe>yes</p><p zen-else>no</p><button zen-for="item in items" zen-key="item.id" zen-probe>row</button>'; document.body.appendChild(root);
  const app = createApp({ state: { show: true, items: [{ id: 1 }] } }); const bind = vi.fn(), release = vi.fn(); app.directive({ name: 'probe', bind() { bind(); return release; } });
  const cleanup = app.mount(root); expect(bind).toHaveBeenCalledTimes(2); cleanup(); expect(release).toHaveBeenCalledTimes(2); expect(root.querySelector('[zen-if]')).not.toBeNull(); expect(root.querySelector('[zen-for]')).not.toBeNull();
  app.mount(root); expect(bind).toHaveBeenCalledTimes(4); app.dispose(); expect(release).toHaveBeenCalledTimes(4);
});
it('cleans partial structural binds without leaving orphan anchors or listeners', () => {
  const root = document.createElement('main'); root.innerHTML = '<section zen-if="true"><button zen-fail></button></section>'; document.body.appendChild(root); const app = createApp(); app.directive({ name: 'fail', bind() { throw new Error('failed child'); } });
  expect(() => app.mount(root)).toThrow(); expect(root.querySelector('[zen-if]')).not.toBeNull(); app.dispose();
});

it('re-enters the element owner for lifecycle hooks and their returned cleanup', () => {
  const root = document.createElement('main'); root.innerHTML = '<section zen-owner></section>'; document.body.appendChild(root); const app = createApp(); const values: unknown[] = [];
  app.directive({ name: 'owner', bind() { provide('local-key', 'element'); onMount(() => { values.push(inject('local-key'), useApp()); onUnmount(() => values.push(inject('local-key'))); return () => values.push(inject('local-key')); }); } });
  app.mount(root); expect(values).toEqual(['element', app]); app.dispose(); expect(values).toEqual(['element', app, 'element', 'element']);
});
