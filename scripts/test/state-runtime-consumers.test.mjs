import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const firstFormat of ['esm', 'cjs']) {
  it(`shares real observer/priority/registry channels when ${firstFormat} is loaded first`, () => {
    const directory = join(process.cwd(), 'packages/state/dist');
    const esm = pathToFileURL(join(directory, 'index.js')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      globalThis.__ZENITH_DEVTOOLS__ = true;
      const loadEsm = () => import(${JSON.stringify(esm)});
      const loadCjs = () => require(${JSON.stringify(join(directory, 'index.cjs'))});
      const first = ${firstFormat === 'esm' ? 'await loadEsm()' : 'loadCjs()'};
      first.clearRegistry();
      const created = [], changed = [], named = [], disposed = [];
      const observer = {
        onCreate: signal => created.push(signal),
        onChange: (signal, oldValue, newValue) => changed.push({ signal, oldValue, newValue }),
        onName: (signal, name) => named.push({ signal, name }),
        onDispose: signal => disposed.push(signal),
      };
      const detach = first.setSignalObserver(observer);
      const early = first.signal(1), earlyId = first.registerSignal(early, 'early');
      const second = ${firstFormat === 'esm' ? 'loadCjs()' : 'await loadEsm()'};
      assert.equal(second.getSignalObserver(), observer);
      assert.equal(second.getSignalInfo(earlyId).signalRef.deref(), early);
      const later = second.signal(2), laterId = second.registerSignal(later, 'later');
      assert.notEqual(laterId, earlyId); assert.equal(first.getSignalInfo(laterId).signalRef.deref(), later);
      assert.deepEqual(created, [early, later]);
      assert.equal(first.isReadable(later), true); assert.equal(second.isReadable(early), true);
      const events = [];
      const stopEvents = first.onStateChange(change => events.push(change));
      later.set(3); assert.equal(changed.length, 1); assert.equal(changed[0].signal, later);
      assert.equal(events.length, 1); assert.equal(events[0].signalId, laterId);
      assert.equal(second.getStateTimeline().length, 1);
      second.nameSignal(early, 'renamed'); assert.equal(first.getSignalInfo(earlyId).name, 'renamed');
      assert.equal(named.at(-1).signal, early);
      later.dispose(); assert.equal(disposed.at(-1), later);
      stopEvents(); detach(); assert.equal(second.getSignalObserver(), null);

      const same = {}, middle = {};
      const a = first.setSignalObserver(same), b = second.setSignalObserver(middle), c = first.setSignalObserver(same);
      a(); c(); assert.equal(second.getSignalObserver(), middle); b(); assert.equal(first.getSignalObserver(), null);
      const failures = [], handler = error => failures.push(error);
      const oldError = first.onEffectError(handler), newError = second.onEffectError(handler);
      oldError(); const failure = new Error('cross format handler');
      first.effect(() => { throw failure; }); assert.deepEqual(failures, [failure]); newError();

      const context = { owner: null, activeEffect: null, activeCleanupRegistration: null };
      first.setEffectContextStore(() => context);
      const previous = first.setCurrentPriority('urgent'); assert.equal(second.getCurrentPriority(), first.Priority.urgent);
      let subscriber, reads = 0;
      const stop = second.effect(() => { subscriber = context.activeEffect; early.get(); reads++; });
      assert.equal(first.getEffectPriority(subscriber), first.Priority.urgent);
      assert.equal(second.getEffectPriority(subscriber), first.Priority.urgent);
      const { flushSync, pendingEffectsByPriority } = await import('@zenith/scheduler');
      early.set(4); assert.equal(pendingEffectsByPriority('urgent'), 1); flushSync(); assert.equal(reads, 2);
      stop(); assert.equal(first.getEffectPriority(subscriber), first.Priority.normal);
      assert.equal(early.subscriberCount, 0); first.setCurrentPriority(previous); first.setEffectContextStore(null);

      first.clearRegistry(); assert.deepEqual(second.getAllSignals(), []);
      early.set(5); assert.deepEqual(second.getStateTimeline(), []);
      const newId = second.registerSignal(early); assert.ok(newId > laterId);
      early.set(6); assert.equal(first.getStateTimeline().length, 1);
      assert.equal(first.getStateTimeline()[0].signalId, newId);
      const { installDevtoolsCore, getAllSignals, hook } = await import('@zenith/devtools-core');
      const coreA = installDevtoolsCore({ enabled: true }), coreB = installDevtoolsCore({ enabled: true });
      coreA.dispose(); assert.equal(globalThis.__ZENITH_DEVTOOLS_HOOK__, hook);
      const modern = second.signal('modern'); assert.ok(getAllSignals().some(info => info.signalRef.deref() === modern));
      coreB.dispose(); assert.equal(first.getSignalObserver(), null);
      modern.dispose(); early.dispose(); first.clearRegistry();
      // Real shared data channels, not a claim that the two constructors or
      // nominal declaration graphs have become the same JavaScript value.
    `], { cwd: process.cwd(), encoding: 'utf8', timeout: 15_000 });
    // No dist/condition skip. These consumers run only in final validation.
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
}
