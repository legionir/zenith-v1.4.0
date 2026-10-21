import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

it('uses the canonical built root for each internal ESM/CJS condition without a second runtime', () => {
  const directory = join(process.cwd(), 'packages/state/dist');
  const esm = pathToFileURL(join(directory, 'index.js')).href;
  const internalEsm = pathToFileURL(join(directory, 'internal.js')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const root = await import(${JSON.stringify(esm)});
    let created = 0;
    const observer = { onCreate: () => { created++; } };
    const restoreObserver = root.setSignalObserver(observer);
    const internal = await import(${JSON.stringify(internalEsm)});
    assert.equal(root.getSignalObserver(), observer);
    const source = root.signal(0);
    assert.equal(created, 1); restoreObserver();
    const cjsRoot = require(${JSON.stringify(join(directory, 'index.cjs'))});
    const cjsInternal = require(${JSON.stringify(join(directory, 'internal.cjs'))});
    for (const [canonical, facade] of [[root, internal], [cjsRoot, cjsInternal]]) {
      assert.deepEqual(Object.keys(facade).sort(), [
        'getEffectPriority', 'isGlobalObservationEnabled', 'registerStateInstance',
        'resetStateInstanceTrackingForTesting', 'setEffectContextStore',
      ]);
      for (const name of Object.keys(facade)) assert.equal(facade[name], canonical[name], name);
      const context = { owner: null, activeEffect: null, activeCleanupRegistration: null };
      facade.setEffectContextStore(() => context);
      let observedPriority;
      const stop = canonical.effect(() => {
        observedPriority = facade.getEffectPriority(context.activeEffect);
        source.get();
      }, { priority: canonical.Priority.urgent });
      assert.equal(observedPriority, canonical.Priority.urgent);
      assert.equal(context.activeEffect, null);
      stop(); assert.equal(source.subscriberCount, 0);
      facade.setEffectContextStore(null);
    }
    // This fixture covers context/ownership, not root constructor identity.
    // Other shared channels have separate built runtime-consumer fixtures.
    const context = { owner: null, activeEffect: null, activeCleanupRegistration: null };
    internal.setEffectContextStore(() => context);
    const owner = root.createOwner(null); root.setOwner(owner);
    assert.equal(cjsRoot.getOwner(), owner);
    const child = cjsRoot.createOwner(); assert.equal(child.parent, owner);
    cjsRoot.disposeOwner(owner); assert.equal(child.disposed, true);
    root.setOwner(null); internal.setEffectContextStore(null);
  `], { encoding: 'utf8', timeout: 15_000 });
  // Intentionally no missing-dist skip: these are final-phase built consumers.
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});

it('keeps internal declarations as canonical root references in both formats', () => {
  for (const extension of ['d.ts', 'd.cts']) {
    const declarations = readFileSync(join(process.cwd(), 'packages/state/dist', `internal.${extension}`), 'utf8');
    expect(declarations).toMatch(/from\s+['"]@zenith\/state['"]/);
    expect(declarations).not.toMatch(/\b(?:class|interface)\s+(?:Signal|Computed|Owner|EffectContext)\b/);
  }
});
