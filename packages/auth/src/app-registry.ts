// packages/auth/src/app-registry.ts
//
// Explicit App/standalone ownership of Auth engines (#118/#139): a reference
// registry adapter, the `authPlugin` installer and `getAppAuth`. Nothing here
// touches the legacy default-app bridge in ./registry.

import { createReferenceRegistry, invariant, type Cleanup, type Disposable } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { s, defineOptions } from '@zenith/schema';
import { Auth } from './engine';
import { createAuth } from './registry';
import { resolveAuthConfig } from './options';
import type { AuthRegistryStore } from './registry-contract';
import type { AuthConfig } from './types';

export type { AuthRegistryStore } from './registry-contract';

/** Reference registry of Auth engines; registering never transfers ownership. @public */
export interface AuthRegistry extends Disposable {
  register(name: string, auth: Auth): Cleanup;
  get(name: string): Auth | undefined;
  has(name: string): boolean;
  list(): string[];
  unregister(name: string): boolean;
}

interface Lease { release: Cleanup; released: boolean }

/**
 * Adapt an explicit reference store (e.g. `app.registries.auth`), or create an
 * isolated standalone one. Cleanups are tied to a registration token; disposing
 * the adapter releases only its own leases and never disposes borrowed engines.
 * @public
 */
export function createAuthRegistry(store?: AuthRegistryStore): AuthRegistry {
  const standalone = store === undefined ? createReferenceRegistry<unknown>() : undefined;
  const target: AuthRegistryStore = store ?? standalone!;
  const leases = new Map<string, Lease>();
  let disposed = false;
  const isAuth = (name: string) => target.get(name) instanceof Auth;

  return {
    register(name, auth) {
      if (disposed) throw createReservedError('ZEN-1090', { details: { reason: 'Auth registry is disposed.' } });
      invariant(typeof name === 'string' && name.trim().length > 0, 'Authentication name must be nonempty.');
      const lease: Lease = { release: target.register(name, auth), released: false };
      leases.set(name, lease);
      return () => {
        if (lease.released) return;
        lease.released = true;
        if (leases.get(name) === lease) leases.delete(name);
        lease.release();
      };
    },
    get: name => { const value = target.get(name); return value instanceof Auth ? value : undefined; },
    has: name => isAuth(name),
    list: () => target.list().filter(isAuth),
    unregister(name) {
      if (disposed || !isAuth(name)) return false;
      const lease = leases.get(name);
      if (lease) { lease.released = true; leases.delete(name); }
      return target.unregister(name);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (const lease of [...leases.values()]) {
        lease.released = true;
        try { lease.release(); } catch (error) { errors.push(error); }
      }
      leases.clear();
      try { standalone?.dispose(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Authentication registry disposal failed.');
    },
  };
}

/** Structural App host; avoids an L2 -> runtime-core dependency. @public */
export interface AuthAppHost {
  registries: { auth: AuthRegistryStore };
}

/** @public */
export interface AuthPluginOptions {
  /** Registry name of the engine. @default 'default' */
  name?: string;
  /** Opt in to cross-tab synchronization. @default false */
  crossTab?: boolean;
}

/** @public */
export const authPluginOptions = defineOptions<Required<AuthPluginOptions>>(
  'AuthPluginOptions',
  s.object({
    name: s.default(s.string({ min: 1 }), 'default'),
    crossTab: s.default(s.boolean(), false),
  }),
);

/**
 * Plugin that creates one Auth engine per App at install time. Options are
 * validated and detached when the descriptor is created, not at module import.
 * @public
 */
export function authPlugin(config: AuthConfig, options?: AuthPluginOptions) {
  const resolved = authPluginOptions.resolve(options);
  const snapshot = resolveAuthConfig(config);
  return {
    name: resolved.name === 'default' ? 'zenith:auth' : `zenith:auth:${resolved.name}`,
    install(app: AuthAppHost): Cleanup {
      const store = app.registries.auth;
      if (store.has(resolved.name)) {
        throw createReservedError('ZEN-1090', {
          details: { reason: `Authentication name "${resolved.name}" is registered by another owner.` },
        });
      }
      const engine = createAuth({ ...snapshot, headers: { ...snapshot.headers } });
      let stopSync: Cleanup = () => {};
      let release: Cleanup = () => {};
      try {
        release = store.register(resolved.name, engine);
        if (resolved.crossTab) stopSync = engine.enableCrossTabSync();
      } catch (error) {
        try { release(); } finally { engine.dispose(); }
        throw error;
      }
      let done = false;
      return () => {
        if (done) return;
        done = true;
        try { stopSync(); } finally { try { release(); } finally { engine.dispose(); } }
      };
    },
  };
}

/** The engine installed by `authPlugin` in this App, if any. @public */
export function getAppAuth(app: AuthAppHost, name = 'default'): Auth | undefined {
  const value = app.registries.auth.get(name);
  return value instanceof Auth ? value : undefined;
}
