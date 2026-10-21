// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { runGlobalResets } from '@zenith/errors';
import { createApp, createRegistry, defaultApp, resetDefaultAppForTesting } from '../src/index';

describe('explicit App registry ownership (#118, unvalidated code-first suite)', () => {
  it('implements register/get/has/list/unregister with registration-bound cleanup', () => {
    const registry = createRegistry<object>();
    const value = {};
    const stale = registry.register('__proto__', value);
    const current = registry.register('__proto__', value);
    stale(); stale();
    expect(registry.get('__proto__')).toBe(value);
    expect(registry.has('__proto__')).toBe(true);
    const names = registry.list(); names.length = 0;
    expect(registry.list()).toEqual(['__proto__']);
    expect(registry.entries()).toEqual([['__proto__', value]]);
    current(); current();
    expect(registry.get('__proto__')).toBeUndefined();
    expect(registry.unregister('__proto__')).toBe(false);
    registry.register('old', value);
    expect(registry.unregister('old')).toBe(true);
    registry.dispose(); registry.dispose();
    expect(() => registry.register('late', value)).toThrow(/ZEN-1090/);
  });

  it('rejects empty keys without introducing a record', () => {
    const registry = createRegistry<number>();
    expect(() => registry.register('', 1)).toThrow(/ZEN-1090/);
    expect(() => registry.register('  ', 1)).toThrow(/ZEN-1090/);
    expect(registry.list()).toEqual([]);
    registry.dispose();
  });

  it('isolates every inventory store between two Apps and clears only its owner', () => {
    const a = createApp(); const b = createApp();
    for (const name of Object.keys(a.registries) as Array<keyof typeof a.registries>) {
      // All inventory entries implement the same protocol. Use real APIs below
      // for the typed action/directive/plugin stores, not erased casts here.
      expect(a.registries[name]).not.toBe(b.registries[name]);
    }
    const templateA = document.createElement('template');
    const templateB = document.createElement('template');
    a.registries.components.register('same', templateA);
    b.registries.components.register('same', templateB);
    for (const name of ['auth', 'permissions', 'resources', 'stores', 'serverComponents', 'devtools'] as const) {
      a.registries[name].register('same', 'a');
      b.registries[name].register('same', 'b');
    }
    a.dispose(); a.dispose();
    for (const registry of Object.values(a.registries)) expect(registry.list()).toEqual([]);
    expect(b.registries.components.get('same')).toBe(templateB);
    for (const name of ['auth', 'permissions', 'resources', 'stores', 'serverComponents', 'devtools'] as const) expect(b.registries[name].get('same')).toBe('b');
    b.dispose();
  });

  it('uses the same registry for action() and directive() as the actual DOM engine', () => {
    const app = createApp(); const root = document.createElement('main');
    const action = vi.fn();
    const stale = app.action('save', action);
    const release = app.action('save', action);
    stale();
    expect(app.registries.actions.get('save')).toBe(action);
    release();
    const definition = { name: 'owned', bind(el: HTMLElement) { el.textContent = 'bound'; } };
    const old = app.directive(definition); const latest = app.directive(definition);
    old(); root.setAttribute('zen-owned', ''); app.mount(root);
    expect(root.textContent).toBe('bound');
    latest(); expect(app.registries.directives.has('zen-owned')).toBe(false);
    app.dispose();
  });

  it('keeps 100 asynchronous owners isolated across scheduling boundaries', async () => {
    await Promise.all(Array.from({ length: 100 }, async (_, index) => {
      const app = createApp();
      try {
        app.registries.auth.register('session', index);
        await Promise.resolve();
        app.registries.resources.register('query', index);
        await Promise.resolve();
        expect(app.registries.auth.get('session')).toBe(index);
        expect(app.registries.resources.get('query')).toBe(index);
      } finally { app.dispose(); }
    }));
  });

  it('does not poison the plugin deduplication marker after a failed install', () => {
    const app = createApp(); let attempts = 0;
    const plugin = { name: 'retry', install() { if (++attempts === 1) throw new Error('fixture'); } };
    expect(() => app.use(plugin)).toThrow('fixture');
    expect(app.registries.plugins.has('retry')).toBe(false);
    app.use(plugin).use(plugin);
    expect(attempts).toBe(2);
    app.dispose();
  });

  it('cleans plugins and registries even when one of multiple roots throws on teardown', () => {
    const app = createApp(); const clean = vi.fn(); const pluginClean = vi.fn();
    app.use({ name: 'cleanup', install: () => pluginClean });
    app.directive({ name: 'cleanup', bind: () => clean });
    app.directive({ name: 'throws', bind: () => () => { throw new Error('teardown'); } });
    const first = document.createElement('div'); first.setAttribute('zen-cleanup', '');
    const second = document.createElement('div'); second.setAttribute('zen-throws', '');
    app.mount(first); app.mount(second);
    expect(() => app.dispose()).toThrow('teardown');
    expect(clean).toHaveBeenCalledTimes(1);
    expect(pluginClean).toHaveBeenCalledTimes(1);
    for (const registry of Object.values(app.registries)) expect(registry.list()).toEqual([]);
    expect(() => app.dispose()).not.toThrow();
    const late = vi.fn(); app.use({ name: 'late', install: late });
    expect(late).not.toHaveBeenCalled();
    app.provide('late', true); expect(app.inject('late')).toBeUndefined();
  });

  it('releases a cleanup returned after reentrant dispose during plugin installation', () => {
    const app = createApp(); const release = vi.fn();
    app.use({ name: 'reentrant', install(owner) { owner.dispose(); return release; } });
    expect(release).toHaveBeenCalledTimes(1);
    expect(app.registries.plugins.list()).toEqual([]);
  });

  it('disposes previously installed plugins if initial plugin installation fails', () => {
    const release = vi.fn();
    expect(() => createApp({ plugins: [
      { name: 'good', install: () => release },
      { name: 'bad', install() { throw new Error('install'); } },
    ] })).toThrow('install');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does not keep listeners from a partially failed mount', () => {
    const app = createApp(); const listener = vi.fn();
    app.directive({ name: 'listener', bind(el) { el.addEventListener('click', listener); return () => el.removeEventListener('click', listener); } });
    app.directive({ name: 'failure', bind() { throw new Error('bind'); } });
    const root = document.createElement('div'); root.innerHTML = '<button zen-listener></button><i zen-failure></i>';
    expect(() => app.mount(root)).toThrow('bind');
    root.querySelector('button')!.click();
    expect(listener).not.toHaveBeenCalled();
    app.dispose();
  });

  it('resets the default App independently from explicit Apps', () => {
    const independent = createApp(); const old = defaultApp();
    independent.registries.auth.register('same', 'independent');
    old.registries.auth.register('same', 'default');
    runGlobalResets();
    expect(defaultApp()).not.toBe(old);
    expect(defaultApp().registries.auth.get('same')).toBeUndefined();
    expect(independent.registries.auth.get('same')).toBe('independent');
    independent.dispose(); resetDefaultAppForTesting();
  });
});

it('routes legacy resource, store and permission APIs into explicit App owners', async () => {
  const { createResource, getResource, registerResource } = await import('@zenith/resource');
  const { defineStore, getStore } = await import('@zenith/store');
  const { createPermissionManager, getPermissionManager } = await import('@zenith/permission');
  const a = createApp(); const b = createApp();
  const useCounter = defineStore('counter', { state: () => ({ count: 0 }) });
  const resource = a.run(() => createResource('same', { url: '/items' }));
  const storeA = a.run(() => useCounter()); const storeB = b.run(() => useCounter());
  const permission = a.run(() => createPermissionManager('same'));
  expect(a.registries.resources.get('same')).toBe(resource);
  expect(a.run(() => getResource('same'))).toBe(resource); expect(b.run(() => getResource('same'))).toBeUndefined();
  expect(a.run(() => getStore('counter'))).toBe(storeA); expect(storeA).not.toBe(storeB);
  expect(a.run(() => getPermissionManager('same'))).toBe(permission); expect(b.run(() => getPermissionManager('same'))).toBeUndefined();
  const replacement = b.run(() => createResource('same', { url: '/other' }));
  const release = a.run(() => registerResource('borrowed', replacement)); b.run(release); expect(a.registries.resources.has('borrowed')).toBe(false); expect(b.registries.resources.get('same')).toBe(replacement);
  a.dispose(); b.dispose(); expect(() => a.run(() => {})).toThrow();
});
