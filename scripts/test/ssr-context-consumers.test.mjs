import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

it('shares native Node DOM contexts and App leases across actual built SSR formats', () => {
  const directory = join(process.cwd(), 'packages/ssr/dist');
  const esm = pathToFileURL(join(directory, 'index.js')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const esm = await import(${JSON.stringify(esm)});
    const cjs = require(${JSON.stringify(join(directory, 'index.cjs'))});
    const state = await import('@zenith/state');
    const otherState = require('@zenith/state');
    const { flushSync } = await import('@zenith/scheduler');
    const { createApp } = await import('@zenith/runtime-core');
    const { routeSignal } = await import('@zenith/router');
    assert.equal(esm.domAls, cjs.domAls);
    const source = state.signal(0), observed = [], cleaned = [];
    await Promise.all(Array.from({ length: 4 }, (_, id) => {
      const renderer = id % 2 ? cjs : esm, reactive = id % 2 ? otherState : state;
      return renderer.renderToString('<main>native owner</main>', {}, {
        route: '/native-' + id, locale: 'locale-' + id,
        app: async context => {
          const owner = reactive.getOwner(); assert.ok(owner);
          assert.equal(esm.getDOMGlobals(), cjs.getDOMGlobals());
          reactive.effect(() => {
            source.get();
            assert.equal(globalThis.document, context.document);
            assert.equal(routeSignal.peek().path, '/native-' + id);
            assert.equal(esm.getDOMGlobals().locale, 'locale-' + id);
            observed.push(id);
          });
          reactive.onCleanup(() => cleaned.push({ id,
            document: globalThis.document === context.document,
            route: routeSignal.peek().path, disposed: owner.disposed,
          }));
          await Promise.resolve(); source.set(source.peek() + 1); flushSync();
          return createApp();
        },
      });
    }));
    assert.equal(source.subscriberCount, 0);
    for (let id = 0; id < 4; id++) {
      assert.ok(observed.includes(id));
      assert.deepEqual(cleaned.filter(row => row.id === id), [
        { id, document: true, route: '/native-' + id, disposed: true },
      ]);
    }
    const app = createApp(); let disposals = 0;
    const original = app.dispose.bind(app); app.dispose = () => { disposals++; original(); };
    await esm.renderToString('<main>first claim</main>', {}, { app: () => app });
    await assert.rejects(cjs.renderToString('<main>second claim</main>', {}, { app: () => app }),
      error => error.code === 'ZEN-1001');
    assert.equal(disposals, 1); source.dispose();
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 15_000 });
  // Final-phase coverage: absence of a built condition is a failure, never a skip.
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
