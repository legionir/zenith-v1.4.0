// @vitest-environment jsdom
//
// #116 — CrudEngine: dispose idempotency + alias destroy ZEN-DEPR-021 +
// نشت disposes (بعد از dispose آرایهٔ internal خالی می‌شود).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { CrudEngine } from '../src/crud-engine';
import { createResource, resetResourceRegistry } from '@zenith/resource';

describe('#116 CrudEngine dispose/cleanup', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    resetResourceRegistry();
    createResource('crud116', { url: '/api/items' });
  });
  afterEach(() => {
    resetDeprecationWarnings();
    resetResourceRegistry();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  function makeEngine(): CrudEngine {
    const host = document.createElement('div');
    document.body.appendChild(host);
    return new CrudEngine({ resource: 'crud116', columns: [{ field: 'name' }] }, host);
  }

  it('dispose() drains internal disposes and is idempotent', () => {
    const engine = makeEngine();
    engine.dispose();
    expect((engine as any).disposes).toHaveLength(0); // نشت = صفر
    expect(() => engine.dispose()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });

  it('destroy() warns once ZEN-DEPR-021 and delegates to dispose', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const engine = makeEngine();
      engine.destroy();
      engine.destroy();
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-021'));
      expect(depr).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});
