import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Final-phase built consumers. Do not fall back to sources or skip missing dist.
// This is the ESM Core/legacy facade boundary, not certification of legacy CJS
// loading ESM-only dependencies on every supported Node version.
it('preserves actual Core graph identity through the built Devtools ESM facade', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import * as core from '@zenith/devtools-core';
    import * as legacy from '@zenith/devtools';
    import { setEffectContextStore } from '@zenith/state/internal';
    globalThis.__ZENITH_DEVTOOLS__ = true;
    assert.equal(legacy.RuntimeGraph, core.RuntimeGraph);
    assert.equal(legacy.DependencyGraph, core.RuntimeGraph);
    assert.equal(legacy.graph, core.runtimeGraph);
    const actual = { native: 'actual object' };
    core.runtimeGraph.addSignal('outside', { value: actual });
    const local = new legacy.RuntimeGraph(); local.addSignal('local', { value: actual });
    assert.equal(local.getGraph().nodes[0].value, actual);
    legacy.devtoolsAPI.enable(); legacy.registerPanelSignal({ get: () => actual });
    const context = { owner: null, activeEffect: null, activeCleanupRegistration: null, globalObservation: false };
    setEffectContextStore(() => context);
    try {
      core.runtimeGraph.clear(); legacy.devtoolsAPI.disable();
      legacy.registerPanelSignal({ get: () => { throw new Error('muted reader must not run'); } });
      assert.deepEqual(core.getRuntimeGraph().nodes, []);
      assert.deepEqual(legacy.devtoolsAPI.getSignals(), []);
      assert.equal(local.getGraph().nodes[0].value, actual);
    } finally { setEffectContextStore(null); }
    try {
      assert.equal(core.getRuntimeGraph().nodes[0].value, actual);
      assert.equal(legacy.devtoolsAPI.enabled, true);
      assert.equal(legacy.devtoolsAPI.getSignals()[0].value, actual);
    } finally { legacy.devtoolsAPI.disable(); core.clearDevtoolsRegistryInternal(); }
  `], { encoding: 'utf8', timeout: 15_000 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});

it('compiles real ESM package graph/options/readonly declarations without workspace paths', () => {
  const require = createRequire(import.meta.url);
  const directory = mkdtempSync(join(tmpdir(), 'zenith-devtools-packaged-types-'));
  try {
    mkdirSync(join(directory, 'node_modules/@zenith'), { recursive: true });
    for (const name of ['state', 'devtools-core', 'devtools']) symlinkSync(join(process.cwd(), 'packages', name), join(directory, 'node_modules/@zenith', name), 'dir');
    writeFileSync(join(directory, 'package.json'), '{"private":true,"type":"module"}');
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022', 'DOM'],
      strict: true, types: [], skipLibCheck: false, noEmit: true,
    }, files: ['consumer.mts'] }));
    writeFileSync(join(directory, 'consumer.mts'), `
import { signal } from '@zenith/state';
import { RuntimeGraph, registerSignal, type GraphSignalOptions, type UntypedSignal } from '@zenith/devtools-core';
import { RuntimeGraph as LegacyGraph, recordPanelStateChange, type PanelStateChangeOptions, type ZenithDevtoolsHook } from '@zenith/devtools';
const actual = signal({ id: 'native' });
const id: string = registerSignal(actual); const readable: UntypedSignal<{ id: string }> = actual;
const graph: RuntimeGraph = new LegacyGraph(); const options: GraphSignalOptions = { name: 'actual', value: actual };
graph.addSignal(id, options); graph.addDirective('directive', { directiveType: 'zen-text', elementSelector: '#actual' });
const change: PanelStateChangeOptions = { oldValue: null, newValue: actual.get() }; recordPanelStateChange(id, change);
function consumeNativeHook(hook: ZenithDevtoolsHook): void {
 hook.addSignal(id, options); hook.addStaticFor('static', { expr: '$items', itemCount: 2 }); hook.recordResourceDestroy('resource', { url: '/actual' });
}
void consumeNativeHook;
// @ts-expect-error A readable diagnostic capability cannot invent a setter.
readable.set({ id: 'forged writable' });
// @ts-expect-error Metadata retains a real string selector contract.
graph.addDirective('invalid', { directiveType: 'zen-text', elementSelector: 1 });
// @ts-expect-error Canonical event options require the next operand.
recordPanelStateChange(id, { oldValue: 1 });
actual.dispose();
`);
    const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(directory, 'tsconfig.json')], { cwd: directory, encoding: 'utf8', timeout: 30_000 });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
