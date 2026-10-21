// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createScopedRegistry } from '@zenith/shared';
import { createApp, definePlugin, inject, onUnmount, onMount, onUpdate, provide, useApp, useId, createInjectionKey } from '../src';
import { createApp as Create } from '../src/app';
import { useApp as Use } from '../src/scope';
import { resolveAppOptions } from '../src/options';
import type { App } from '../src';
const apps: App[] = [];
afterEach(() => { for (const app of apps.splice(0)) app.dispose(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
function app(state: Record<string, unknown> = {}): App { const owner = createApp({ state }); apps.push(owner); return owner; }
it('keeps facade functions identical to their owner modules', () => { expect(createApp).toBe(Create); expect(useApp).toBe(Use); });
it('restores the outer App after nested runs and thrown callbacks', () => {
  const outer = app(), inner = app();
  outer.run(() => {
    expect(useApp()).toBe(outer);
    expect(() => inner.run(() => { expect(useApp()).toBe(inner); throw new Error('nested'); })).toThrow('nested');
    expect(useApp()).toBe(outer);
  });
  expect(() => useApp()).toThrow();
});
it('does not retain a synchronous ambient App across an async continuation', async () => {
  const owner = app(); const result = owner.run(async () => { expect(useApp()).toBe(owner); await Promise.resolve(); expect(() => useApp()).toThrow(); });
  await result;
});
it('retains state-value identity, per-element hook ownership and reactive updates', () => {
  const value = signal('first'), state = { value }, owner = app(state), calls: string[] = [];
  owner.directive({ name: 'zen-owner-probe', bind(_element, ctx) {
    expect(ctx.app).toBe(owner); expect(ctx.state).not.toBe(state); expect(ctx.state.value).toBe(value); expect(useApp()).toBe(owner);
    onMount(() => { calls.push('mount'); return () => { calls.push('mount-cleanup'); }; });
    onUnmount(() => { calls.push('dispose'); }); onUpdate(() => { calls.push('update'); });
    ctx.notifyUpdate();
  } });
  const root = document.createElement('main'); root.innerHTML = '<span zen-owner-probe zen-text="value"></span>'; document.body.append(root);
  const stop = owner.mount(root); expect(calls).toEqual(['update', 'mount']); expect(root.textContent).toBe('first');
  value.set('second'); flushSync(); expect(root.textContent).toBe('second'); stop(); stop(); expect(calls.filter(item => item === 'dispose')).toHaveLength(1); expect(calls.filter(item => item === 'mount-cleanup')).toHaveLength(1);
  value.set('late'); flushSync(); expect(root.textContent).toBe('second'); value.dispose();
});
it('retains lexical injection ancestry independently of another App and sibling scopes', () => {
  const key = createInjectionKey<string>('owner'), owner = app(), other = app(); const values: Array<string | undefined> = [];
  owner.provide(key, 'app'); other.provide(key, 'other');
  owner.directive({ name: 'zen-parent-value', bind() { provide(key, 'parent'); } });
  owner.directive({ name: 'zen-read-value', bind() { values.push(inject(key)); } });
  const root = document.createElement('main'); root.innerHTML = '<section zen-parent-value><b zen-read-value></b></section><i zen-read-value></i>'; document.body.append(root); owner.mount(root);
  expect(values).toEqual(['parent', 'app']); expect(other.run(() => inject(key))).toBe('other');
  expect(owner.run(() => useId('stable'))).toBe('stable-1'); expect(other.run(() => useId('stable'))).toBe('stable-1');
});
it('resolves every captured registry to the original App table rather than a copied registry container', () => {
  const first = app(), second = app(); const directive = { name: 'zen-table-item', bind() {} };
  const directives = createScopedRegistry<typeof directive>('directives');
  const action = (_ctx: unknown) => {}, actions = createScopedRegistry<typeof action>('actions');
  const releaseFirst = first.run(() => directives.register('same', directive));
  expect(first.registries.directives.get('same')).toBe(directive); expect(second.registries.directives.has('same')).toBe(false);
  second.run(() => actions.register('action', action)); expect(second.registries.actions.get('action')).toBe(action);
  expect(first.run(() => directives.capture())).toBe(first.registries.directives);
  expect(second.run(() => actions.capture())).toBe(second.registries.actions);
  first.dispose(); releaseFirst(); expect(second.registries.actions.has('action')).toBe(true);
});
it('retains typed plugin installation, same-App scope and one cleanup per App', () => {
  const first = app(), second = app(), seen: App[] = [], cleanup = vi.fn();
  const plugin = definePlugin({ name: 'owner-refactor', install(owner: App) { seen.push(useApp()); expect(owner).toBe(useApp()); return cleanup; } });
  first.use(plugin); first.use(plugin); second.use(plugin); expect(seen).toEqual([first, second]);
  first.dispose(); expect(cleanup).toHaveBeenCalledTimes(1); second.dispose(); expect(cleanup).toHaveBeenCalledTimes(2);
});
it('validates callable configuration without changing callback identities', () => {
  const errorHandler = vi.fn(), warnHandler = vi.fn(); const options = resolveAppOptions({ errorHandler, warnHandler });
  expect(options.errorHandler).toBe(errorHandler); expect(options.warnHandler).toBe(warnHandler);
  expect(() => resolveAppOptions({ errorHandler: 'not callable' })).toThrow(); expect(() => resolveAppOptions({ warnHandler: {} })).toThrow();
});
