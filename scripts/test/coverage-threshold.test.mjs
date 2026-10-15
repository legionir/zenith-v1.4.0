import { describe, it, expect } from 'vitest';
import config from '../../vitest.config';

describe('CI coverage thresholds (#29)', () => {
  it('enforces >= 80% statement coverage globally and per core package (state, scheduler, expressions, compiler)', () => {
    const coverage = config.test?.coverage;
    expect(coverage).toBeDefined();
    expect(coverage.provider).toBe('v8');
    expect(coverage.thresholds?.statements).toBeGreaterThanOrEqual(80);
    expect(coverage.thresholds?.['packages/state/src/**']?.statements).toBeGreaterThanOrEqual(80);
    expect(coverage.thresholds?.['packages/scheduler/src/**']?.statements).toBeGreaterThanOrEqual(
      80,
    );
    expect(coverage.thresholds?.['packages/expressions/src/**']?.statements).toBeGreaterThanOrEqual(
      80,
    );
    expect(coverage.thresholds?.['packages/compiler/src/**']?.statements).toBeGreaterThanOrEqual(
      80,
    );
  });
});
