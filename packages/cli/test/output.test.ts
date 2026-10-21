import { afterEach, expect, it, vi } from 'vitest';
import { output } from '../src/output';
import { logger } from '@zenith/logger';
afterEach(() => { logger.setLevel('debug'); vi.restoreAllMocks(); });
it('keeps structured stdout data available even when diagnostics are silent', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true); const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  logger.setLevel('silent'); output.json({ schemaVersion: 1, ok: true }); expect(stdout).toHaveBeenCalledWith('{"schemaVersion":1,"ok":true}\n'); expect(stderr).not.toHaveBeenCalled();
});
it('does not emit a partial or invalid JSON line for unsupported values', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  expect(() => output.json(undefined)).toThrow(TypeError); expect(stdout).not.toHaveBeenCalled();
});
