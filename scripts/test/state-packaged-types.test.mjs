import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Final-phase fixture only: compile real package exports with no workspace paths,
// ambient Vitest types, inherited root tsconfig or fallback to TypeScript sources.
it('compiles both packaged root/internal declaration consumers in NodeNext', () => {
  const require = createRequire(import.meta.url);
  const directory = mkdtempSync(join(tmpdir(), 'zenith-state-packaged-types-'));
  try {
    mkdirSync(join(directory, 'node_modules/@zenith'), { recursive: true });
    symlinkSync(join(process.cwd(), 'packages/state'), join(directory, 'node_modules/@zenith/state'), 'dir');
    writeFileSync(join(directory, 'package.json'), '{"private":true,"type":"module"}');
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM'], types: [], strict: true, skipLibCheck: false, noEmit: true,
    }, files: ['consumer.mts', 'consumer.cts'] }));
    const consumer = `
import { signal, effect, Priority, type EffectSubscriber, type Owner, type ReadonlySignal } from '@zenith/state';
import { setEffectContextStore, getEffectPriority, isGlobalObservationEnabled, type EffectContext } from '@zenith/state/internal';
const owner: Owner = { children: new Set(), cleanup: new Set(), disposed: false };
const context: EffectContext = { owner, activeEffect: null, activeCleanupRegistration: null, globalObservation: false,
  bind: callback => (...args) => callback(...args), registerDisposal: callback => { void callback; } };
setEffectContextStore(() => context);
const actual = signal({ count: 1 });
const readonly: ReadonlySignal<{ count: number }> = actual;
const stop = effect(() => { readonly.get().count; }, { priority: Priority.high });
const subscriber: EffectSubscriber = () => {}; const priority: Priority = getEffectPriority(subscriber);
const allowed: boolean = isGlobalObservationEnabled(); void priority; void allowed;
// @ts-expect-error The readable capability does not manufacture a setter.
readonly.set({ count: 2 });
// @ts-expect-error Root nominal Signal value types remain specific.
actual.set({ count: 'not a number' });
if (context.bind) {
 const bound = context.bind((key: string, count: number) => ({ key, count }));
 const result: { key: string; count: number } = bound('valid', 1); void result;
 // @ts-expect-error The internal declaration must retain the real argument order.
 bound(1, 'invalid');
}
stop(); actual.dispose(); setEffectContextStore(null);
`;
    for (const extension of ['mts', 'cts']) writeFileSync(join(directory, `consumer.${extension}`), consumer);
    const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(directory, 'tsconfig.json')], {
      cwd: directory, encoding: 'utf8', timeout: 30_000,
    });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
