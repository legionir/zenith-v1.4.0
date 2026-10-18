import type { StorePersistStorage } from './types';
import { storeRegistry, ownerForStore } from './registry';
import { memoryFor } from './storage-state';
export function resolvePersistStorage(custom: StorePersistStorage | undefined, store: object): StorePersistStorage {
  if (custom) return custom;
  try { const storage = globalThis.localStorage; if (storage) return storage; } catch { /* restricted storage */ }
  const values = memoryFor(ownerForStore(store) ?? storeRegistry.capture());
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
