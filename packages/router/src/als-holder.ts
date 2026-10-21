import type { Signal } from '@zenith/state';
import type { RouteState } from './route-state';
/** @internal */
export interface RouteStore { signal: Signal<RouteState>; }
/** Browser-safe capability boundary; this module has no Node imports. @internal */
export interface RouteContextStorage {
  getStore(): RouteStore | undefined;
  run<R>(store: RouteStore, callback: () => R): R;
}
// A dual-format import must not allocate two independent native contexts.
// This is a holder for ALS, never a shared fallback request store.
const CONTEXT_KEY: unique symbol = Symbol.for('zenith.router.context.v1');
interface ContextHolder { storage?: RouteContextStorage; loading?: Promise<void>; browserSignal?: Signal<RouteState>; }
const host = globalThis as typeof globalThis & { [CONTEXT_KEY]?: ContextHolder };
const context = host[CONTEXT_KEY] ?? {};
if (!host[CONTEXT_KEY]) Object.defineProperty(host, CONTEXT_KEY, { value: context });
/** @internal */
export function browserRouteSingleton(create: () => Signal<RouteState>): Signal<RouteState> { return context.browserSignal ??= create(); }
/** @internal */
export type AlsInitResult = 'ok' | 'unavailable' | 'browser';
function nodeProcess(): { getBuiltinModule?: (id: string) => unknown } | undefined {
  const process: unknown = Reflect.get(globalThis, 'process');
  if (!process || typeof process !== 'object' || !('versions' in process)) return undefined;
  const versions = process.versions;
  if (!versions || typeof versions !== 'object' || !('node' in versions) || typeof versions.node !== 'string') return undefined;
  const get = Reflect.get(process, 'getBuiltinModule');
  return typeof get === 'function' ? { getBuiltinModule: (id: string): unknown => Reflect.apply(get, process, [id]) } : {};
}
function acquire(namespace: unknown): void {
  if (!namespace || typeof namespace !== 'object' || !('AsyncLocalStorage' in namespace) || typeof namespace.AsyncLocalStorage !== 'function') throw new Error('Native route AsyncLocalStorage is unavailable.');
  const Constructor = namespace.AsyncLocalStorage as new () => RouteContextStorage;
  context.storage ??= new Constructor();
}
/** Install a native storage from the explicit Node entry. @internal */
export function installRouteContextStorage(value: RouteContextStorage): void { context.storage ??= value; }
/** Synchronous native capability on hosts that provide getBuiltinModule. @internal */
export function ensureRouteAsyncContext(): AlsInitResult {
  if (context.storage) return 'ok';
  const process = nodeProcess(); if (!process) return 'browser';
  if (typeof process.getBuiltinModule !== 'function') return 'unavailable';
  acquire(process.getBuiltinModule('node:async_hooks')); return 'ok';
}
/** Async Node entry works on every declared Node floor, without global fallback. @internal */
export async function ensureRouteAsyncContextAsync(): Promise<AlsInitResult> {
  const result = ensureRouteAsyncContext(); if (result !== 'unavailable') return result;
  // A variable specifier keeps Node builtins out of browser bundles. This branch
  // is never entered without a genuine Node process; Workers use explicit contexts.
  context.loading ??= (async () => { const name = 'node:async_hooks'; const namespace: unknown = await import(/* @vite-ignore */ name); acquire(namespace); })();
  try { await context.loading; } catch (error) { context.loading = undefined; throw error; }
  return 'ok';
}
/** @internal */
export function getRouteAsyncLocalStorage(): RouteContextStorage | undefined { return context.storage; }
