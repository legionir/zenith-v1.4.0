import { defaultApp, type App } from '@zenith/runtime-core';
import { setAuthRegistryOwner, type AuthRegistryOwner } from '@zenith/auth';
import { invariant, type Cleanup } from '@zenith/shared';

const owners = new WeakMap<App, AuthRegistryOwner>();

function ownerFor(app: App): AuthRegistryOwner {
  const existing = owners.get(app);
  if (existing) return existing;
  const callbacks = new Set<Cleanup>();
  let disposed = false;
  let installed = false;
  const owner: AuthRegistryOwner = {
    registry: app.registries.auth,
    onDispose(cleanup) {
      if (disposed) { cleanup(); return () => {}; }
      callbacks.add(cleanup);
      return () => { callbacks.delete(cleanup); };
    },
  };
  app.use({ name: 'zenith:legacy-auth-owner', install() {
    installed = true;
    return () => {
      if (disposed) return;
      disposed = true;
      const pending = [...callbacks]; callbacks.clear();
      const errors: unknown[] = [];
      for (const cleanup of pending) { try { cleanup(); } catch (error) { errors.push(error); } }
      if (errors.length) throw new AggregateError(errors, 'Legacy authentication owner cleanup failed.');
    };
  } });
  invariant(installed, 'Cannot attach legacy authentication to a disposed or conflicting App owner.');
  owners.set(app, owner);
  return owner;
}

/**
 * L3 bootstrap. Installing does not create an App, read storage, or start auth.
 * Each operation resolves the default App explicitly; other Apps never participate.
 * The returned cleanup detaches this bridge, not the lifetime of any App. @internal
 */
export function installLegacyAuthOwnerBridge(): Cleanup {
  return setAuthRegistryOwner(() => ownerFor(defaultApp()));
}
