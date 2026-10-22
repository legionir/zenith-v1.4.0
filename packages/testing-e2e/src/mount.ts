import { createApp, type App, type Plugin } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createReservedError } from '@zenith/errors';
import type { BrowserMountOptions, TestMountController } from './contract';

function failure(expected: string) { return createReservedError('ZEN-1090', { details: { expected } }); }
/** @internal */
export interface MountDependencies {
  installBridge(options: {
    signals: Record<string, { get(): unknown; set?(value: never): void }>;
    ready(): boolean;
    snapshot(): unknown;
  }): { dispose(): void };
  importModule?(url: string): Promise<Record<string, unknown>>;
}

/** An explicit owner, not a module-global App. @internal */
export function createMountController(doc: Document, dependencies: MountDependencies): TestMountController & { dispose(): void } {
  let generation = 0;
  let disposed = false;
  const cancellations = new Set<() => void>();
  let current: { app: App; root: HTMLElement; bridge: { dispose(): void }; ready: boolean } | undefined;
  const load = dependencies.importModule ?? (async (url: string) => await import(/* @vite-ignore */ url) as Record<string, unknown>);
  const unmount = () => {
    generation++;
    const pending = [...cancellations]; cancellations.clear();
    for (const cancel of pending) cancel();
    const previous = current;
    current = undefined;
    if (!previous) return;
    previous.ready = false;
    try { previous.bridge.dispose(); }
    finally { try { previous.app.dispose(); } finally { previous.root.remove(); } }
  };
  return {
    unmount,
    dispose() { if (disposed) return; disposed = true; unmount(); },
    async mount(options: BrowserMountOptions) {
      if (disposed) throw failure('an active test mount host');
      if (!options || typeof options.html !== 'string' || (options.state !== undefined && (!options.state || typeof options.state !== 'object' || Array.isArray(options.state)))) throw failure('HTML and a state record');
      if (options.plugins !== undefined && !Array.isArray(options.plugins)) throw failure('an array of plugin module descriptors');
      const timeout = options.mountTimeout ?? 5000;
      if (!Number.isFinite(timeout) || timeout <= 0) throw failure('positive mountTimeout');
      unmount();
      const epoch = generation;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancel = () => {};
      const cancelled = new Promise<never>((_, reject) => { cancel = () => reject(failure('a current mount owner')); });
      cancellations.add(cancel);
      try {
        const plugins = await Promise.race([
          cancelled,
          Promise.all((options.plugins ?? []).map(async descriptor => {
            if (!descriptor || typeof descriptor.module !== 'string' || !descriptor.module) throw failure('a plugin module URL');
            const module = await load(descriptor.module);
            const plugin = module[descriptor.exportName ?? 'default'];
            if (!plugin || typeof plugin !== 'object' || typeof (plugin as Plugin<unknown>).name !== 'string' || typeof (plugin as Plugin<unknown>).install !== 'function') throw failure('a named installable plugin export');
            return [plugin as Plugin<unknown>, descriptor.options] as [Plugin<unknown>, unknown];
          })),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(failure('test App module loading within mountTimeout')), timeout); }),
        ]);
        if (epoch !== generation) throw failure('a current mount owner');
        const state = Object.fromEntries(Object.entries(options.state ?? {}).map(([name, value]) => [name, signal(value)]));
        let app: App;
        try { app = createApp({ state, devtools: false, idPrefix: options.idPrefix ?? 'zen-test' }); }
        catch (error) { for (const value of Object.values(state)) value.dispose(); throw error; }
        app.use({ name: 'zenith:testing-e2e:signals', install: () => () => { for (const value of Object.values(state)) value.dispose(); } });
        const root = doc.createElement('main');
        root.setAttribute('data-zen-test-app', '');
        let bridge: { dispose(): void } | undefined;
        try {
          for (const plugin of plugins) app.use(plugin);
          if (!app.registries.plugins.has('zenith:testing-e2e:signals')) throw failure('an active App after plugin installation');
          // Test fixture source, not an application-facing HTML/XSS sanitizer.
          root.innerHTML = options.html;
          doc.body.appendChild(root);
          const mounted = { app, root, ready: false, bridge: { dispose() {} } };
          bridge = dependencies.installBridge({
            signals: Object.fromEntries(Object.entries(state).map(([name, value]) => [name, {
              get: () => value.get(), set: (next: unknown) => { value.set(next); flushSync(); },
            }])),
            ready: () => current === mounted && mounted.ready,
            snapshot: () => ({
              state: Object.fromEntries(Object.entries(state).map(([name, value]) => [name, value.get()])),
              registries: Object.fromEntries(Object.entries(app.registries).map(([name, registry]) => [name, registry.list()])),
            }),
          });
          mounted.bridge = bridge;
          current = mounted;
          app.mount(root);
          flushSync();
          mounted.ready = true;
        } catch (error) {
          if (current?.app === app) current = undefined;
          try { bridge?.dispose(); } finally { try { app.dispose(); } finally { root.remove(); } }
          throw error;
        }
      } catch (error) {
        if (epoch === generation) unmount();
        throw error;
      } finally { cancellations.delete(cancel); if (timer !== undefined) clearTimeout(timer); }
    },
  };
}
