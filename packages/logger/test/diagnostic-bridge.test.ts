import { afterEach, expect, it, vi } from 'vitest';
import { deprecate, resetDeprecationWarnings } from '@zenith/errors';
import { logger, installDiagnosticLogger } from '../src';
afterEach(() => { logger.setLevel('debug'); resetDeprecationWarnings(); vi.restoreAllMocks(); });
it('routes legacy diagnostics through the same silent filter as logger output', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {}); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const cleanup = installDiagnosticLogger(); logger.setLevel('silent'); deprecate('ZEN-DEPR-055', 'clearComponents', 'resetForTesting'); logger.warn('diagnostic');
  expect(log).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); cleanup();
});
