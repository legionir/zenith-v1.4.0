import { afterEach, expect, it } from 'vitest';
import {
  clearDevtoolsRegistryInternal, getRegisteredApps, getRegisteredCaches, getRegisteredStores,
  registerApp, registerDevtoolsCache, registerDevtoolsStore,
} from '../src';

afterEach(() => { clearDevtoolsRegistryInternal(); });
for (const [register, read] of [
  [registerApp, getRegisteredApps], [registerDevtoolsCache, getRegisteredCaches],
  [registerDevtoolsStore, getRegisteredStores],
] as const) {
  it(`${register.name} keeps same-value replacement identity and stale reset cleanup separate`, () => {
    const actual = { actual: true };
    const first = register('same', actual), second = register('same', actual);
    try {
      first(); first(); expect(read().get('same')).toBe(actual);
      clearDevtoolsRegistryInternal(); const third = register('same', actual);
      try { second(); expect(read().get('same')).toBe(actual); }
      finally { third(); }
      expect(read().has('same')).toBe(false);
    } finally { first(); second(); }
  });
}
