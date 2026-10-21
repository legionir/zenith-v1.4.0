import { signal } from '@zenith/state';
import { deprecate, onGlobalReset } from '@zenith/errors';
import { invariant } from '@zenith/shared';
import { resolveFunctionalAuthConfig } from './options';
import { Auth } from './engine';
import { toCanonical } from './configuration-adapter';
import type { AuthConfig } from './types';
import type { AuthRegistryStore } from './registry-contract';
/**
 * ساخت یک Auth instance.
 */
export function createAuth(config: AuthConfig): Auth {
  return new Auth(config);
}

/**
 * Registry از Auth instances.
 */
/** Structural lifecycle owner supplied by the higher runtime layer. @internal */
export interface AuthRegistryOwner {
  registry: AuthRegistryStore;
  /** Subscribe to disposal. The returned cleanup only detaches this callback. */
  onDispose(cleanup: () => void): () => void;
}

type AuthRegistration = {
  name: string;
  value: Auth;
  owned: boolean;
  release(preserveValue?: boolean): void;
  adopted?: AuthRegistration;
};

const fallbackValues = new Map<string, { value: unknown }>();
const fallbackRegistry: AuthRegistryStore = {
  register(name, value) {
    const token = { value }; fallbackValues.set(name, token);
    return () => { if (fallbackValues.get(name) === token) fallbackValues.delete(name); };
  },
  get: name => fallbackValues.get(name)?.value,
  has: name => fallbackValues.has(name),
  list: () => [...fallbackValues.keys()],
  unregister: name => fallbackValues.delete(name),
};
const registrations = new Set<AuthRegistration>();
const registrationsByStore = new WeakMap<AuthRegistryStore, Map<string, AuthRegistration>>();
/** Shared with functional compatibility views, not a public root export. @internal */
export const defaultAuthRef = signal<Auth | null>(null);
let registryOwnerProvider: { resolve: () => AuthRegistryOwner } | null = null;
let selectedRegistry: AuthRegistryStore | null = null;
const observedRegistries = new WeakSet<AuthRegistryStore>();
const registryObservations = new Set<() => void>();

/**
 * Higher-layer bridge; resolving is lazy and never changes an ambient current App.
 * Latest installation wins; stale cleanup cannot remove a newer installation.
 * Cleanup does not resurrect a former provider. @internal
 */
export function setAuthRegistryOwner(resolve: () => AuthRegistryOwner): () => void {
  const token = { resolve };
  registryOwnerProvider = token;
  selectedRegistry = null;
  defaultAuthRef.set(null);
  return () => {
    if (registryOwnerProvider !== token) return;
    registryOwnerProvider = null;
    selectedRegistry = null;
    defaultAuthRef.set(null);
  };
}

function registerInOwner(owner: AuthRegistryOwner | null, name: string, value: Auth, owned: boolean): AuthRegistration {
  const registry = owner?.registry ?? fallbackRegistry;
  const entries = registrationsByStore.get(registry) ?? new Map<string, AuthRegistration>();
  registrationsByStore.set(registry, entries);
  const previous = entries.get(name);
  const sameValue = previous?.value === value;
  const ownsValue = owned || (sameValue && previous?.owned === true);
  try { previous?.release(sameValue); }
  catch (error) { if (sameValue && previous?.owned) previous.value.dispose(); throw error; }
  const releaseReference = registry.register(name, value);
  let detachOwner = () => {};
  let active = true;
  const entry: AuthRegistration = {
    name, value, owned: ownsValue,
    release(preserveValue = false) {
      if (!active) { entry.adopted?.release(preserveValue); return; }
      active = false;
      registrations.delete(entry);
      if (entries.get(name) === entry) entries.delete(name);
      // Release every resource even if a custom structural registry throws.
      try { releaseReference(); } finally {
        try { detachOwner(); } finally {
          if (name === 'default' && selectedRegistry === registry) {
            const current = registry.get('default');
            defaultAuthRef.set(current instanceof Auth ? current : null);
          }
          if (ownsValue && !preserveValue) value.dispose();
        }
      }
    },
  };
  entries.set(name, entry);
  registrations.add(entry);
  try { if (owner) detachOwner = owner.onDispose(() => entry.release()); }
  catch (error) { try { entry.release(); } catch { /* preserve subscription failure */ } throw error; }
  if (active && name === 'default' && selectedRegistry === registry) defaultAuthRef.set(value);
  return entry;
}

function activeAuthOwner(): AuthRegistryOwner | null {
  const owner = registryOwnerProvider?.resolve() ?? null;
  if (!owner) { selectedRegistry = fallbackRegistry; return null; }
  selectedRegistry = owner.registry;
  const registry = owner.registry;
  if (registry.subscribe && !observedRegistries.has(registry)) {
    const unsubscribe = registry.subscribe(name => {
      if (name !== null) {
        const entry = registrationsByStore.get(registry)?.get(name);
        // Direct App writes may supersede a legacy lease. Release only our
        // old reference/owned factory client, never the replacing App value.
        if (entry && registry.get(name) !== entry.value) entry.release();
      }
      if (selectedRegistry !== registry || (name !== null && name !== 'default')) return;
      const current = registry.get('default');
      defaultAuthRef.set(current instanceof Auth ? current : null);
    });
    observedRegistries.add(registry);
    let active = true;
    let detachOwner = () => {};
    const stop = () => {
      if (!active) return;
      active = false;
      registryObservations.delete(stop);
      observedRegistries.delete(registry);
      try { unsubscribe(); } finally {
        try { detachOwner(); } finally {
          if (selectedRegistry === registry) { selectedRegistry = null; defaultAuthRef.set(null); }
        }
      }
    };
    registryObservations.add(stop);
    try { detachOwner = owner.onDispose(stop); }
    catch (error) { try { stop(); } catch { /* preserve ownership failure */ } throw error; }
  }

  // Adopt pre-bootstrap registrations once, preserving registration ownership.
  // An explicit App registration wins collisions, rather than being overwritten.
  const pending = registrationsByStore.get(fallbackRegistry);
  for (const entry of [...(pending?.values() ?? [])]) {
    if (owner.registry.has(entry.name) && owner.registry.get(entry.name) !== entry.value) entry.release();
    else {
      const { name, value, owned } = entry;
      entry.release(true);
      try { entry.adopted = registerInOwner(owner, name, value, owned); }
      catch (error) { if (owned) value.dispose(); throw error; }
    }
  }
  return owner;
}

/** Borrowed reference registration; lifecycle belongs to the creator. */
export function registerAuth(name: string, auth: Auth): () => void {
  invariant(typeof name === 'string' && name.trim().length > 0, 'Authentication name must be nonempty.');
  const entry = registerInOwner(activeAuthOwner(), name, auth, false);
  return () => entry.release();
}
export function getAuth(name = 'default'): Auth | undefined {
  const registry = activeAuthOwner()?.registry ?? fallbackRegistry;
  const value = registry.get(name);
  return value instanceof Auth ? value : undefined;
}
export function hasAuth(name = 'default'): boolean { return getAuth(name) !== undefined; }
export function listAuths(): string[] {
  const registry = activeAuthOwner()?.registry ?? fallbackRegistry;
  return registry.list().filter(name => registry.get(name) instanceof Auth);
}
/** Unregister references; only automatically created defaults are implicitly owned. */
export function unregisterAuth(name: string): boolean {
  const registry = activeAuthOwner()?.registry ?? fallbackRegistry;
  const existing = registry.get(name);
  if (!(existing instanceof Auth)) return false;
  const entry = registrationsByStore.get(registry)?.get(name);
  let removed = false;
  // Delete the current reference once. A subscriber may register a replacement
  // during notification; a second name-based delete would incorrectly remove it.
  try { removed = registry.unregister(name); } finally { entry?.release(); }
  if (name === 'default') {
    const current = registry.get('default');
    defaultAuthRef.set(current instanceof Auth ? current : null);
  }
  return removed;
}

/** @public @deprecated Use resetForTesting() (@zenith/testing). ZEN-DEPR-056; removed in 2.0. */
export function clearAuth(): void {
  deprecate('ZEN-DEPR-056', 'clearAuth', 'resetForTesting() (@zenith/testing)');
  clearAuthInternal();
}
/**
 * Reset existing leases without resolving/creating a default App. Explicit plugin
 * registrations and borrowed values remain their creating owner's responsibility.
 * @internal
 */
export function clearAuthInternal(): void {
  const errors: unknown[] = [];
  for (const entry of [...registrations]) {
    try { entry.release(); } catch (error) { errors.push(error); }
  }
  for (const stop of [...registryObservations]) {
    try { stop(); } catch (error) { errors.push(error); }
  }
  defaultAuthRef.set(null);
  if (errors.length) throw new AggregateError(errors, 'Authentication reset failed.');
}

// Reset registration is observable and must survive the published bundle.
onGlobalReset(clearAuthInternal);

// ============================================================
// FEATURE (v1.4.0): Functional Auth API
// ============================================================

// Deprecated functional surface: compatibility views on the canonical default engine.

/** All legacy helpers resolve this registry's default canonical engine. */
export function getDefaultAuth(): Auth {
  const existing = getAuth();
  if (existing) { if (defaultAuthRef.peek() !== existing) defaultAuthRef.set(existing); return existing; }
  const owner = activeAuthOwner();
  invariant(!(owner?.registry ?? fallbackRegistry).has('default'), 'Default authentication name is occupied by another provider.');
  const instance = createAuth(toCanonical(resolveFunctionalAuthConfig()));
  try { registerInOwner(owner, 'default', instance, true); }
  catch (error) { instance.dispose(); throw error; }
  return instance;
}

