import { invariant, createDisposer, type Cleanup, type Disposer } from '@zenith/shared';
import { logger as defaultLogger } from '@zenith/logger';
import { defineDirectiveMeta } from '@zenith/schema';
import { flushSync } from '@zenith/scheduler';
import type { App, AppOptions, ResolvedAppOptions, DirectiveDefinition, Plugin } from './types';
import { appOptions } from './options';
import { createAppRegistries } from './registry';
import { installRegistryOwnerProvider, registryOwners, runWithApp, getCurrentScope, runInScope, flushMountCallbacks, type ScopeFrame } from './scope';
import { buildStructuralDirectives } from './directives/structural';
import { buildValueDirectives } from './directives/value';
import { createWalker } from './walker';
import { defaultAppState } from './default-state';

let nextAppInstanceSeq = 1;

/** @public */
export function createApp(options?: AppOptions): App {
  const validated = appOptions.resolve(options);
  const idPrefix = validated.idPrefix ?? 'zen';
  const appId = `${idPrefix}-app-${nextAppInstanceSeq++}`;
  let idCounter = 0;

  const resolvedConfig: ResolvedAppOptions = {
    state: { ...(validated.state ?? {}) },
    plugins: [...(validated.plugins ?? [])],
    devtools:
      options?.devtools !== undefined
        ? Boolean(validated.devtools)
        : (globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__ !== false,
    delegationRoot: validated.delegationRoot,
    strictParity: Boolean(validated.strictParity),
    logger: validated.logger ?? defaultLogger,
    errorHandler: validated.errorHandler,
    warnHandler: validated.warnHandler,
    idPrefix,
    ssr: {
      preloadState: validated.ssr?.preloadState ?? true,
      validateHydration: validated.ssr?.validateHydration ?? false,
    },
  };

  const registries = Object.freeze(createAppRegistries());
  const { directives, plugins: installedPlugins, actions } = registries;
  for (const d of [...buildStructuralDirectives(), ...buildValueDirectives()]) directives.register(d.name, d);

  const appProvides = new Map<string | symbol, unknown>();
  const mountedRoots = new Map<HTMLElement, Disposer>();
  const appDisposer = createDisposer();
  let disposed = false;

  const app: App = {
    id: appId,
    config: resolvedConfig,
    registries,
    run<T>(callback: () => T): T {
      invariant(!disposed, 'Cannot enter a disposed App.');
      return runWithApp(app, callback);
    },

    nextId(): string {
      return `${idPrefix}-${++idCounter}`;
    },

    use<O = unknown>(pluginOrTuple: Plugin<O> | [Plugin<O>, O], opts?: O): App {
      if (disposed) return app;
      const [plugin, pluginOpts] = Array.isArray(pluginOrTuple)
        ? [pluginOrTuple[0], pluginOrTuple[1]]
        : [pluginOrTuple, opts];
      if (!plugin || typeof plugin.name !== 'string' || typeof plugin.install !== 'function') {
        return app;
      }
      // پلاگین دوباره‌نصب‌نشدنی (SPEC §۲.۸)
      if (installedPlugins.has(plugin.name)) {
        return app;
      }
      const release = installedPlugins.register(plugin.name, plugin);
      try {
        const cleanup = runWithApp(app, () => plugin.install(app, pluginOpts));
        if (typeof cleanup === 'function') {
          if (disposed) cleanup();
          else appDisposer.add(cleanup);
        }
      } catch (error) {
        release();
        throw error;
      }
      return app;
    },

    directive(nameOrDef: string | DirectiveDefinition, maybeDef?: DirectiveDefinition): Cleanup {
      if (disposed) return () => {};
      const def: DirectiveDefinition =
        typeof nameOrDef === 'string'
          ? { ...(maybeDef as DirectiveDefinition), name: nameOrDef }
          : nameOrDef;
      if (def.meta) defineDirectiveMeta(def.meta);
      const attrKey = def.name.startsWith('zen-') ? def.name : `zen-${def.name}`;
      const releaseName = directives.register(def.name, def);
      const releaseAttribute = attrKey === def.name ? () => {} : directives.register(attrKey, def);
      return () => { releaseName(); releaseAttribute(); };
    },

    provide<T>(key: string | symbol, value: T): App {
      if (disposed) return app;
      const scope = getCurrentScope();
      if (scope?.app === app) {
        scope.provides.set(key, value);
      } else {
        appProvides.set(key, value);
      }
      return app;
    },

    inject<T>(key: string | symbol, defaultValue?: T): T | undefined {
      if (appProvides.has(key)) {
        return appProvides.get(key) as T;
      }
      return defaultValue;
    },

    addState(values: Record<string, unknown>, options?: { overwrite?: boolean }): App {
      if (disposed) return app;
      const overwrite = options?.overwrite ?? false;
      for (const [key, value] of Object.entries(values)) {
        if (!overwrite && key in resolvedConfig.state) {
          const msg = `[Zenith] addState: کلید «${key}» قبلاً در state موجود است؛ بازنویسی نشد (overwrite: true برای حالت override).`;
          if (resolvedConfig.warnHandler) {
            resolvedConfig.warnHandler(msg, { key });
          } else {
            resolvedConfig.logger.warn(msg);
          }
          continue;
        }
        resolvedConfig.state[key] = value;
      }
      return app;
    },

    action(name, fn): Cleanup {
      if (disposed) return () => {};
      return actions.register(name, fn);
    },

    mount(root: HTMLElement, stateOverride?: Record<string, unknown>): Cleanup {
      if (disposed) {
        return () => {};
      }
      // اگر قبلاً روی همین root سوار شده بود، ابتدا پاک‌سازی کن
      const prevDisposer = mountedRoots.get(root);
      if (prevDisposer) {
        prevDisposer.dispose();
        mountedRoots.delete(root);
      }

      const rootDisposer = createDisposer();
      mountedRoots.set(root, rootDisposer);

      const mergedState: Record<string, unknown> = {
        ...resolvedConfig.state,
        ...(stateOverride ?? {}),
      };
      for (const [actName, actFn] of actions.entries()) {
        if (!(actName in mergedState)) {
          mergedState[actName] = actFn;
        }
      }

      const rootFrame: ScopeFrame = {
        app,
        disposes: rootDisposer,
        mountCallbacks: [],
        updateCallbacks: [],
        provides: new Map(),
        parent: null,
      };

      try {
        runInScope(rootFrame, () => {
          walkElement(root, mergedState, {}, rootFrame);
        });
        flushMountCallbacks(rootFrame);
        flushSync();
      } catch (error) {
        if (mountedRoots.get(root) === rootDisposer) mountedRoots.delete(root);
        try { rootDisposer.dispose(); } catch { /* retain the bind failure */ }
        throw error;
      }

      let unmounted = false;
      return () => {
        if (unmounted) return;
        unmounted = true;
        if (mountedRoots.get(root) === rootDisposer) mountedRoots.delete(root);
        rootDisposer.dispose();
      };
    },

    unmount(): void {
      const cleanup = createDisposer();
      for (const disposer of mountedRoots.values()) cleanup.add(disposer);
      // Detach before invoking user code, including reentrant unmount().
      mountedRoots.clear();
      cleanup.dispose();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      // Detach first: teardown may reenter a legacy helper and ask for a fresh
      // default owner. Never return this disposed App from defaultApp().
      if (defaultAppState.current === app) defaultAppState.current = null;
      const cleanup = createDisposer();
      cleanup.add(() => {
        appProvides.clear();
        for (const registry of Object.values(registries)) registry.dispose();
      });
      cleanup.add(appDisposer);
      cleanup.add(() => app.unmount());
      // LIFO: roots, plugins, then references. Errors cannot skip a later stage.
      cleanup.dispose();
    },
  };
  const { walkElement, dispose: disposeWalker } = createWalker(app, directives);
  appDisposer.add(disposeWalker);
  installRegistryOwnerProvider();
  registryOwners.set(app, { registries, addCleanup: cleanup => { if (disposed) cleanup(); else appDisposer.add(cleanup); } });


  // نصب پلاگین‌های اولیه در options.plugins
  try {
    for (const entry of resolvedConfig.plugins) app.use(entry);
  } catch (error) {
    try { app.dispose(); } catch { /* preserve the installation error */ }
    throw error;
  }

  return app;
}

