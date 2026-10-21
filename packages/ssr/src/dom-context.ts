import type { SSRDOMWindow } from './dom-types';
import type { EffectContext } from '@zenith/state/internal';
import type { ActionRegistry, App } from '@zenith/runtime';
import type { ServerComponent } from './server-component';
import type { RegistryOwner } from '@zenith/shared';
import type { HeadManager } from '@zenith/head';
// This is the Node entry. Workers use ./edge and never import this module.
// A process.getBuiltinModule probe silently fell back to a shared stack on Node
// 18, which is not async-context isolation. Use the native API on every Node floor.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface AsyncContextStore<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}

/** Host/adapter integration only; canonical home is `@zenith/ssr/internal`. @internal */
export function isAsyncLocalStorageAvailable(): boolean {
  return typeof AsyncLocalStorage === 'function';
}

/** Host/adapter integration only; canonical home is `@zenith/ssr/internal`. @internal */
export function createAsyncContextStore<T>(): AsyncContextStore<T> {
  return new AsyncLocalStorage<T>();
}

/** Host/adapter integration only; canonical home is `@zenith/ssr/internal`. @internal */
export function getSSRRuntimeEnv(): 'node' | 'edge' | 'browser' {
  const g = globalThis;
  const process: unknown = Reflect.get(g, 'process');
  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined' && !getDOMGlobals()) {
    return 'browser';
  }
  if (process && typeof process === 'object' && 'versions' in process && process.versions && typeof process.versions === 'object' && 'node' in process.versions) {
    return 'node';
  }
  return 'edge';
}

/** Request-scoped DOM/registry globals; host integration only. @internal */
export interface DOMGlobals {
  registryOwner?: RegistryOwner;
  head?: HeadManager;
  window?: SSRDOMWindow;
  document?: SSRDOMWindow['document'];
  Node?: SSRDOMWindow['Node'];
  HTMLElement?: SSRDOMWindow['HTMLElement'];
  Element?: SSRDOMWindow['Element'];
  Event?: SSRDOMWindow['Event'];
  history?: SSRDOMWindow['history'];
  location?: SSRDOMWindow['location'];
  DOMParser?: SSRDOMWindow['DOMParser'];
  MouseEvent?: SSRDOMWindow['MouseEvent'];
  KeyboardEvent?: SSRDOMWindow['KeyboardEvent'];
  /** #92: ایزولاسیون رجیستری‌های سطح درخواست در SSR هم‌زمان */
  effectContext?: EffectContext;
  componentRegistry?: Map<string, HTMLTemplateElement>;
  actionRegistry?: ActionRegistry;
  serverComponents?: Map<string, ServerComponent>;
  locale?: string;
}

const DOM_CONTEXT_SYMBOL = Symbol.for('zenith.ssr.dom-context.v1');
interface DOMContextSingleton {
  store: AsyncContextStore<DOMGlobals>;
  globalsInstalled: boolean;
  activeApps: WeakSet<App>;
  factoryApps: WeakSet<App>;
}
function getDOMContextSingleton(): DOMContextSingleton {
  const globals = globalThis as unknown as Record<symbol, DOMContextSingleton | undefined>;
  let singleton = globals[DOM_CONTEXT_SYMBOL];
  if (!singleton) {
    singleton = {
      store: createAsyncContextStore<DOMGlobals>(), globalsInstalled: false,
      activeApps: new WeakSet(), factoryApps: new WeakSet(),
    };
    globals[DOM_CONTEXT_SYMBOL] = singleton;
  }
  return singleton;
}

/** Node render conditions must not claim the same App through separate sets. */
export function getSSRAppOwnership(): Pick<DOMContextSingleton, 'activeApps' | 'factoryApps'> {
  return getDOMContextSingleton();
}

/** @internal */
export const domAls: AsyncContextStore<DOMGlobals> = getDOMContextSingleton().store;

/** Capture ALL native ALS stores (DOM, route, App), once per registration. */
export function bindSSRCallback<Args extends unknown[], T>(callback: (...args: Args) => T): (...args: Args) => T {
  const resume = AsyncLocalStorage.snapshot();
  return (...args: Args) => resume(callback, ...args);
}

/** Request store reader; canonical home is `@zenith/ssr/internal`. @internal */
export function getDOMGlobals(): DOMGlobals | undefined {
  return domAls.getStore();
}

const GLOBAL_KEYS = [
  'window',
  'document',
  'Node',
  'HTMLElement',
  'Element',
  'Event',
  'history',
  'location',
  'DOMParser',
  'MouseEvent',
  'KeyboardEvent',
] as const;

/** @internal (canonical home: `@zenith/ssr/internal`) */
export function installDOMGlobalGetters(): void {
  const singleton = getDOMContextSingleton();
  if (singleton.globalsInstalled) return;
  if (typeof document !== 'undefined') return;
  singleton.globalsInstalled = true;
  for (const key of GLOBAL_KEYS) {
    const nativeValue = Reflect.get(globalThis, key);
    Object.defineProperty(globalThis, key, {
      get() {
        const store = getDOMGlobals();
        return store ? store[key as keyof DOMGlobals] : nativeValue;
      },
      configurable: true,
      enumerable: true,
    });
  }
}

if (typeof document === 'undefined') {
  installDOMGlobalGetters();
}
