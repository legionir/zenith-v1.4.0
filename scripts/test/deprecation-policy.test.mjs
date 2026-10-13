import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEPRECATION_CODES, deprecate, resetDeprecationWarnings } from '../../packages/errors/src';

const ROOT = process.cwd();

describe('Public API Stability & Deprecation Policy (#58)', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    vi.restoreAllMocks();
  });

  it('documents SemVer contract, 3-stage deprecation lifecycle, and migration guide', () => {
    const policyPath = join(ROOT, 'docs/DEPRECATION-POLICY.md');
    const migrationPath = join(ROOT, 'docs/migration-guide.md');
    expect(existsSync(policyPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const policy = readFileSync(policyPath, 'utf8');
    expect(policy).toContain('Semantic Versioning');
    expect(policy).toContain('Three-Stage Deprecation Lifecycle');
    expect(policy).toContain('deprecate()');

    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('DEPRECATION-POLICY.md');
    expect(migration).toContain('ZEN-DEPR-001');
    expect(migration).toContain('ZEN-DEPR-035');
  });

  it('every registered ZEN-DEPR-* code has api, replacement, and removedIn === 2.0.0', () => {
    const entries = Object.entries(DEPRECATION_CODES);
    expect(entries.length).toBeGreaterThanOrEqual(41);
    for (const [code, meta] of entries) {
      expect(code).toMatch(/^ZEN-DEPR-\d{3}$/);
      expect(meta.api.length).toBeGreaterThan(0);
      expect(meta.replacement.length).toBeGreaterThan(0);
      expect(meta.removedIn).toBe('2.0.0');
    }
  });

  it('deprecate() logs once per code in dev mode and is silent when __ZENITH_DEV__ === false', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ZEN-DEPR-001');

    resetDeprecationWarnings();
    const prev = globalThis.__ZENITH_DEV__;
    globalThis.__ZENITH_DEV__ = false;
    try {
      deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.__ZENITH_DEV__ = prev;
    }
  });
});
