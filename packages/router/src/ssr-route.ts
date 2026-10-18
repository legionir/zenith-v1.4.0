import { signal } from '@zenith/state';
import { ensureRouteAsyncContext, ensureRouteAsyncContextAsync, getRouteAsyncLocalStorage } from './als-holder';
import type { RouteState } from './route-state';
/**
 * Run in an exclusively owned native async route context. Shared-global fallback
 * is deliberately forbidden: unavailable isolation must not look successful.
 * @public
 */
export async function runWithRoute<T>(initialPath: string, fn: () => Promise<T> | T): Promise<T> {
  await ensureRouteAsyncContextAsync();
  const storage = getRouteAsyncLocalStorage();
  if (!storage) throw new Error('runWithRoute requires a native Node route context.');
  const contextSignal = signal<RouteState>({ path: initialPath, params: {} });
  return storage.run({ signal: contextSignal }, async () => { try { return await fn(); } finally { contextSignal.dispose(); } });
}
/**
 * Synchronous scope. On older Node floors import @zenith/router/node first (or
 * finish one async runWithRoute); never borrow the browser singleton for SSR.
 * @public
 */
export function runWithRouteSync<T>(initialPath: string, fn: () => T): T {
  ensureRouteAsyncContext();
  const storage = getRouteAsyncLocalStorage();
  if (!storage) throw new Error('Synchronous route isolation requires @zenith/router/node.');
  const contextSignal = signal<RouteState>({ path: initialPath, params: {} });
  return storage.run({ signal: contextSignal }, () => { try { return fn(); } finally { contextSignal.dispose(); } });
}
