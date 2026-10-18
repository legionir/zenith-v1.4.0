import { createScopedRegistry, createDisposer } from '@zenith/shared';
import { deprecate, onGlobalReset } from '@zenith/errors';
import { clearMemoryFor } from './storage-state';
import type { Store, StorePlugin } from './types';
// Type erasure is private to this heterogeneous store registry.
export const storeRegistry = createScopedRegistry<Pick<Store<unknown, Record<never, never>, Record<never, never>>, 'dispose'>>('stores');
const owners = new WeakMap<object, ReturnType<typeof storeRegistry.capture>>();
export function setStoreOwner(store: object): void { owners.set(store, storeRegistry.capture()); }
export function ownerForStore(store: object) { return owners.get(store); }
type ScopePlugin = StorePlugin<unknown, Record<never, never>, Record<never, never>>;
const plugins = new WeakMap<object, Set<ScopePlugin>>();
export function storePluginsFor(): Set<ScopePlugin> {
  const scope = storeRegistry.capture(); let values = plugins.get(scope);
  if (!values) { values = new Set(); plugins.set(scope, values); const owned = values; scope.subscribe(name => { if (name === null) owned.clear(); }); }
  return values;
}
/** Install defaults for stores created in the captured App, not another App. @public */
export function useStorePlugin(plugin: StorePlugin): () => void {
  const owned = storePluginsFor(); owned.add(plugin); let active = true;
  const release = () => { if (!active) return; active = false; owned.delete(plugin); }; storeRegistry.own(release); return release;
}
export function getStore<S = unknown, G = Record<never, never>, A = Record<never, never>>(id: string): Store<S, G, A> | undefined {
  return storeRegistry.get(id) as Store<S, G, A> | undefined;
}

/** #118: ثبت مستقیم Store در رجیستری با بازگشت Cleanup idempotent. */
export function registerStore<S, G, A>(name: string, store: Store<S, G, A>): () => void {
  return storeRegistry.register(name, store);
}

/** #118: بررسی وجود Store ثبت‌شده (`hasX`). */
export function hasStore(name: string): boolean {
  return storeRegistry.has(name);
}

/** #118: فهرست نام تمام Storeهای ثبت‌شده (`listXs`). */
export function listStores(): string[] {
  return Array.from(storeRegistry.keys());
}

/** #118: حذف یک Store با نام از رجیستری (`unregisterX`). */
export function unregisterStore(name: string): boolean {
  const existing = storeRegistry.get(name);
  if (!existing) return false;
  existing.dispose();
  storeRegistry.delete(name);
  return true;
}

/**
 * پاکسازی همه‌ی store ها (برای تست‌ها).
 */
export function clearStores(): void {
  deprecate('ZEN-DEPR-059', 'clearStores', 'resetForTesting() (@zenith/testing)');
  clearStoresInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearStoresInternal(): void {
  const owned = createDisposer(); for (const store of storeRegistry.values()) owned.add(() => store.dispose());
  try { owned.dispose(); } finally { storeRegistry.clear(); storePluginsFor().clear(); clearMemoryFor(storeRegistry.capture()); }
}

/* @__PURE__ */ onGlobalReset(clearStoresInternal);
