import { expect, it } from 'vitest';
import * as root from '../src/index';
import * as internal from '../src/internal';
import type { AsyncContextStore, DOMGlobals } from '../src/internal';

it('#56 `@zenith/ssr/internal` exposes the same host-integration symbols as the root (one ALS graph)', () => {
  const names = [
    'domAls',
    'getDOMGlobals',
    'installDOMGlobalGetters',
    'isAsyncLocalStorageAvailable',
    'createAsyncContextStore',
    'getSSRRuntimeEnv',
  ] as const;
  for (const name of names) {
    expect((internal as Record<string, unknown>)[name], name).toBe(
      (root as Record<string, unknown>)[name],
    );
  }
  expect(Object.keys(internal).sort()).toEqual([...names].sort());
});

// Type surface rides the same self-specifier facade (erased at runtime).
const _types: { store: AsyncContextStore<unknown>; globals: DOMGlobals } | null = null;
void _types;
