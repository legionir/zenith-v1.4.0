import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal, effect } from '../../packages/state/src';
import { flushSync, pendingEffectCount } from '../../packages/scheduler/src';

const ROOT = process.cwd();

describe('Dual ESM/CJS package hazard prevention (#75)', () => {
  it('stores @zenith/state and @zenith/scheduler singleton state on globalThis via Symbol.for', () => {
    const stateSymbol = Symbol.for('zenith.state.context.v1');
    const schedSymbol = Symbol.for('zenith.scheduler.state.v1');

    const count = signal(1);
    let observed = 0;
    const dispose = effect(() => {
      observed = count.get();
    });
    expect(observed).toBe(1);

    const stateSingleton = globalThis[stateSymbol];
    const schedSingleton = globalThis[schedSymbol];
    expect(stateSingleton).toBeDefined();
    expect(typeof stateSingleton).toBe('object');
    expect(schedSingleton).toBeDefined();
    expect(schedSingleton.queue).toBeInstanceOf(Map);

    count.set(2);
    expect(pendingEffectCount()).toBe(1);
    expect(schedSingleton.queue.size).toBe(1);
    flushSync();
    expect(observed).toBe(2);
    dispose();
  });

  it('documents the dual-package hazard strategy in ARCHITECTURE.md (#75)', () => {
    const arch = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8');
    expect(arch).toContain('Dual-Package Hazard (#75');
    expect(arch).toContain('zenith.state.context.v1');
    expect(arch).toContain('zenith.scheduler.state.v1');
  });
});
