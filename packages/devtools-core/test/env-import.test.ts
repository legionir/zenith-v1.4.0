// #147 — تست import در محیط Node بدون DOM (SSR-safe).
import { describe, it, expect } from 'vitest';

describe('@zenith/devtools-core imports cleanly in Node (no DOM)', () => {
  it('loads without touching window/document at import time', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.installDevtoolsCore).toBe('function');
    expect(typeof mod.registerSignal).toBe('function');
    expect(typeof mod.snapshot).toBe('function');
    expect(typeof mod.restore).toBe('function');
    expect(typeof mod.replay).toBe('function');
    expect(typeof mod.RuntimeGraph).toBe('function');
  });
});
