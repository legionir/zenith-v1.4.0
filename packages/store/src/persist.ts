import type { Store, StorePersistOptions } from './types';
import { resolvePersistStorage } from './storage';

/** @public */
export function persistStore<S = unknown, G = Record<never, never>, A = Record<never, never>>(
  store: Store<S, G, A>,
  options: StorePersistOptions<S> = {},
): () => void {
  const storage = resolvePersistStorage(options.storage, store);
  const key = options.key ?? `zenith:store:${store.$name || 'default'}`;
  const version = options.version ?? 1;

  const filterState = (raw: S): Partial<S> => {
    if (!raw || typeof raw !== 'object') return raw;
    if (options.pick && options.pick.length > 0) {
      const picked: Partial<S> = {};
      for (const k of options.pick) {
        if (k in raw) picked[k] = raw[k];
      }
      return picked;
    }
    if (options.omit && options.omit.length > 0) {
      const omitSet = new Set<string>(options.omit);
      const copy: Partial<S> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!omitSet.has(k)) Reflect.set(copy, k, v);
      }
      return copy;
    }
    return { ...raw };
  };

  // بازیابی اولیه از storage
  try {
    const rawStr = storage.getItem(key);
    if (rawStr) {
      const decoded: unknown = JSON.parse(rawStr);
      const parsed = decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded as Record<string, unknown> : undefined;
      let restoredState: unknown =
        parsed && typeof parsed === 'object' && '__zenithVersion' in parsed ? parsed.state : parsed;
      const persistedVersion =
        parsed && typeof parsed === 'object' && typeof parsed.__zenithVersion === 'number'
          ? parsed.__zenithVersion
          : 0;
      if (persistedVersion !== version && typeof options.migrate === 'function') {
        restoredState = options.migrate(restoredState, persistedVersion);
      }
      if (restoredState && typeof restoredState === 'object') {
        store.$patch(filterState(restoredState as S));
      }
    }
  } catch {
    // ignore corrupt persisted JSON
  }

  return store.$subscribe((currentState) => {
    try {
      const payload = JSON.stringify({
        __zenithVersion: version,
        state: filterState(currentState),
      });
      storage.setItem(key, payload);
    } catch {
      // ignore quota errors
    }
  });
}

