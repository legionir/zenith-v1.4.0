import { describe, expect, it } from 'vitest';
import { DEFAULTS, validateE2eOptions, assertE2eOptions, e2eOptionsSchema } from '../src/options';
import { safeValidate } from '@zenith/schema';

describe('testing-e2e option validation (#166, not run)', () => {
  it('exposes frozen documented defaults and a usable schema', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(DEFAULTS.hydrationTimeout).toBe(5000);
    expect(DEFAULTS.failOnConsoleError).toBe(true);
    expect(safeValidate(e2eOptionsSchema, {}).ok).toBe(true);
    expect(validateE2eOptions({ baseURL: '/test-host', a11y: { rules: ['button-name'], exclude: ['.excluded'], impact: 'critical' } })).toBe(true);
  });
  it('rejects invalid timeouts, flags and a11y shapes before using Playwright/axe', () => {
    for (const value of [null, [], 3, { hydrationTimeout: 0 }, { hydrationTimeout: Infinity }, { failOnConsoleError: 'false' }, { baseURL: '' }, { a11y: [] }, { a11y: { impact: 'unknown' } }, { a11y: { rules: 'button-name' } }, { a11y: { exclude: [''] } }]) {
      expect(validateE2eOptions(value)).toBe(false);
      expect(() => assertE2eOptions(value)).toThrow(/ZEN-1090/);
      expect(safeValidate(e2eOptionsSchema, value).ok).toBe(false);
    }
  });
});
