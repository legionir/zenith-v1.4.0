import { invariant } from './assert';
import type { Cleanup, Disposable } from './types';
/** A reference registry: registering a borrowed value does not transfer its lifecycle. */
export interface ReferenceRegistry<T> extends Disposable {
  register(name: string, value: T): Cleanup;
  get(name: string): T | undefined;
  has(name: string): boolean;
  list(): string[];
  entries(): Array<[string, T]>;
  unregister(name: string): boolean;
  subscribe(listener: (name: string | null) => void): Cleanup;
}
/** Each registration owns its token, including replacement with the same object. */
export function createReferenceRegistry<T>(options: { onObserverError?: () => void; legacyMap?: Map<string, T> } = {}): ReferenceRegistry<T> {
  const values = options.legacyMap ?? new Map<string, T>(); const tokens = new Map<string, object>(); const listeners = new Set<(name: string | null) => void>(); let disposed = false;
  const notify = (name: string | null) => { for (const listener of [...listeners]) { try { listener(name); } catch { try { options.onObserverError?.(); } catch { /* Keep registration atomic. */ } } } };
  return {
    register(name, value) {
      invariant(!disposed, 'Cannot register on a disposed registry.'); invariant(typeof name === 'string' && name.trim().length > 0, 'Registry name must be nonempty.');
      const entry = {}; tokens.set(name, entry); values.set(name, value); notify(name); let released = false;
      return () => { if (released) return; released = true; if (tokens.get(name) === entry && values.get(name) === value) { tokens.delete(name); values.delete(name); notify(name); } };
    },
    get: name => values.get(name), has: name => values.has(name), list: () => [...values.keys()], entries: () => [...values],
    unregister(name) { tokens.delete(name); if (!values.delete(name)) return false; notify(name); return true; },
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { if (disposed) return; disposed = true; values.clear(); tokens.clear(); notify(null); listeners.clear(); },
  };
}
/** @internal Lower-layer adapters can resolve an owner without importing runtime-core. */
export interface RegistryOwner {
  registries: Readonly<Record<string, ReferenceRegistry<unknown>>>;
  addCleanup(cleanup: Cleanup): void;
}
const providers: Array<{ resolve: () => RegistryOwner | null; priority: number }> = [];
/** Install synchronous access to an App or an async-context-local SSR owner. */
export function registerRegistryOwnerProvider(provider: () => RegistryOwner | null, options: { priority?: number } = {}): Cleanup {
  const entry = { resolve: provider, priority: options.priority ?? 0 }; providers.push(entry); providers.sort((a, b) => a.priority - b.priority); let active = true;
  return () => { if (!active) return; active = false; const index = providers.indexOf(entry); if (index >= 0) providers.splice(index, 1); };
}
function resolveOwner(): RegistryOwner | undefined {
  for (let i = providers.length - 1; i >= 0; i--) { const owner = providers[i]!.resolve(); if (owner) return owner; }
  return undefined;
}
/** Map-shaped compatibility adapter. Capture register cleanup, never resolve an owner at teardown. */
export function createScopedRegistry<T>(namespace: string, options: { fallback?: () => ReferenceRegistry<T> } = {}) {
  const fallback = createReferenceRegistry<T>();
  const capture = (): ReferenceRegistry<T> => {
    const owner = resolveOwner();
    if (!owner) return options.fallback?.() ?? fallback;
    const registry = owner.registries[namespace];
    invariant(registry !== undefined, `Unknown registry namespace: ${namespace}`);
    // Namespace identity is fixed by the package, not caller-controlled data.
    return registry as ReferenceRegistry<T>;
  };
  return {
    capture,
    own(cleanup: Cleanup): void { resolveOwner()?.addCleanup(cleanup); },
    register: (name: string, value: T): Cleanup => capture().register(name, value),
    set(name: string, value: T): void { capture().register(name, value); },
    get: (name: string): T | undefined => capture().get(name), has: (name: string): boolean => capture().has(name),
    delete: (name: string): boolean => capture().unregister(name), keys: (): IterableIterator<string> => capture().list().values(),
    values: (): IterableIterator<T> => capture().entries().map(([, value]) => value).values(),
    entries: (): IterableIterator<[string, T]> => capture().entries().values(),
    [Symbol.iterator](): IterableIterator<[string, T]> { return this.entries(); },
    clear(): void { const registry = capture(); for (const name of registry.list()) registry.unregister(name); },
  };
}
