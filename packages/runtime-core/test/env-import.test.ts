// #148 — تست import در محیط Node بدون DOM (SSR-safe).
import { describe, it, expect } from 'vitest';

describe('@zenith/runtime-core imports cleanly in Node (no DOM)', () => {
  it('loads without touching window/document at import time', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.createApp).toBe('function');
    expect(typeof mod.defineDirective).toBe('function');
    expect(typeof mod.definePlugin).toBe('function');
    expect(typeof mod.hydrate).toBe('function');
    expect(typeof mod.assertCompatible).toBe('function');
  });
});
