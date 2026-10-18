import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

it('shares the route holder across built ESM/CJS root and native Node entries', () => {
  const directory = join(process.cwd(), 'packages/router/dist');
  const esm = pathToFileURL(join(directory, 'index.js')).href;
  const nodeEsm = pathToFileURL(join(directory, 'node.js')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const root = await import(${JSON.stringify(esm)});
    const native = await import(${JSON.stringify(nodeEsm)});
    const otherRoot = require(${JSON.stringify(join(directory, 'index.cjs'))});
    const otherNative = require(${JSON.stringify(join(directory, 'node.cjs'))});
    root.routeSignal.set({ path: '/outside', params: {} });
    assert.equal(otherRoot.routeSignal.peek().path, '/outside');
    native.runWithRouteSync('/esm', () => assert.equal(otherRoot.routeSignal.peek().path, '/esm'));
    otherNative.runWithRouteSync('/cjs', () => assert.equal(root.routeSignal.peek().path, '/cjs'));
    await native.runWithRoute('/async', async () => {
      await Promise.resolve(); assert.equal(otherRoot.routeSignal.get().path, '/async');
    });
    assert.equal(root.routeSignal.get().path, '/outside');
  `], { encoding: 'utf8', timeout: 15_000 });
  // No missing-dist skip: final validation must build every declared condition.
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
