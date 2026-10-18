// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { logger } from '@zenith/logger';
import { processResource } from '../src/directive';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('narrows unknown expression results before constructing or fetching a Resource', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const children = vi.fn();
  const release = processResource(document.createElement('div'), 'endpoint', { endpoint: { token: 'private-value' } }, children, []);
  release(); release();
  expect(fetch).not.toHaveBeenCalled(); expect(children).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'ZEN-1001' }));
  expect(JSON.stringify(error.mock.calls)).not.toContain('private-value');
});
it('reports expression failures without printing the raw exception or context values', () => {
  const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const release = processResource(document.createElement('div'), 'missing', { privateKey: 'private-value' }, vi.fn(), []);
  release();
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'ZEN-1001' }));
  expect(JSON.stringify(error.mock.calls)).not.toContain('private-value');
});
