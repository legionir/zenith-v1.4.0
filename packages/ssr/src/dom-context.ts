// packages/ssr/src/dom-context.ts
//
// FEATURE (v1.0.0) + #92: AsyncLocalStorage & Edge-compatible DOM/Request isolation.
//
// هر درخواست SSR وضعیت کامل خود را (DOM globals، EffectContext، ComponentRegistry،
// ActionRegistry، ServerComponentRegistry، App، locale) در یک store مستقل
// بر پایهٔ AsyncLocalStorage ذخیره می‌کند.
//
// پشتیبانی از Edge runtimeها (#92):
//   1. اگر `globalThis.AsyncLocalStorage` موجود باشد (Cloudflare Workers با
//      nodejs_compat، Vercel Edge، Deno، WinterCG)، مستقیماً از آن استفاده می‌شود.
//   2. در Node.js (18.19+/20.6+)، از `process.getBuiltinModule('node:async_hooks')`
//      به‌صورت بدون وابستگی استاتیک باندلر بارگذاری می‌شود.
//   3. در محیط‌های تک‌رشته‌ای فاقد `AsyncLocalStorage`، یک پشتهٔ کانتکست سبک
//      (`FallbackContextStorage`) فراهم می‌شود و `isAsyncLocalStorageAvailable()`
//      وضعیت واقعی را گزارش می‌دهد.

export interface AsyncContextStore<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}

class FallbackContextStorage<T> implements AsyncContextStore<T> {
  private _stack: T[] = [];

  getStore(): T | undefined {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : undefined;
  }

  run<R>(store: T, callback: () => R): R {
    this._stack.push(store);
    let isAsync = false;
    try {
      const result = callback();
      if (result && typeof (result as unknown as Promise<unknown>).then === 'function') {
        isAsync = true;
        return (result as unknown as Promise<unknown>).finally(() => {
          const idx = this._stack.lastIndexOf(store);
          if (idx !== -1) this._stack.splice(idx, 1);
        }) as unknown as R;
      }
      return result;
    } finally {
      if (!isAsync) {
        const idx = this._stack.lastIndexOf(store);
        if (idx !== -1) this._stack.splice(idx, 1);
      }
    }
  }
}

function resolveAsyncLocalStorageCtor(): (new <T>() => AsyncContextStore<T>) | null {
  try {
    const g = globalThis as Record<string, any>;
    if (typeof g.AsyncLocalStorage === 'function') {
      return g.AsyncLocalStorage;
    }
    const proc = g.process;
    if (proc?.versions?.node && typeof proc.getBuiltinModule === 'function') {
      const mod = proc.getBuiltinModule('node:async_hooks');
      if (mod && typeof mod.AsyncLocalStorage === 'function') {
        return mod.AsyncLocalStorage;
      }
    }
  } catch {
    // ignore and fall back
  }
  return null;
}

export function isAsyncLocalStorageAvailable(): boolean {
  return resolveAsyncLocalStorageCtor() !== null;
}

export function createAsyncContextStore<T>(): AsyncContextStore<T> {
  const Ctor = resolveAsyncLocalStorageCtor();
  return Ctor ? new Ctor<T>() : new FallbackContextStorage<T>();
}

export function getSSRRuntimeEnv(): 'node' | 'edge' | 'browser' {
  const g = globalThis as Record<string, any>;
  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined' && !getDOMGlobals()) {
    return 'browser';
  }
  if (g.process?.versions?.node) {
    return 'node';
  }
  return 'edge';
}

export interface DOMGlobals {
  window: any;
  document: any;
  Node: any;
  HTMLElement: any;
  Element: any;
  Event: any;
  history: any;
  location: any;
  DOMParser: any;
  MouseEvent: any;
  KeyboardEvent: any;
  /** #92: ایزولاسیون رجیستری‌های سطح درخواست در SSR هم‌زمان */
  effectContext?: any;
  componentRegistry?: Map<string, any>;
  actionRegistry?: any;
  serverComponents?: Map<string, any>;
  locale?: string;
}

/** @internal */
export const domAls: AsyncContextStore<DOMGlobals> = createAsyncContextStore<DOMGlobals>();

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

let _installed = false;

/** @internal */
export function installDOMGlobalGetters(): void {
  if (_installed) return;
  if (typeof document !== 'undefined') return;
  _installed = true;
  for (const key of GLOBAL_KEYS) {
    const nativeValue = (globalThis as any)[key];
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
