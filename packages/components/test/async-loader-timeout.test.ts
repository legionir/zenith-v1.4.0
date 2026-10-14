// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadComponent, clearComponentCache, configureComponentCache } from '../src/index';

describe('@zenith/components async-loader fetch timeout (#15)', () => {
  beforeEach(() => {
    clearComponentCache();
    configureComponentCache({ ttl: 300_000, maxSize: 64, timeout: 10_000 });
  });

  it('aborts and rejects with ZEN-2002 HTTP_TIMEOUT when fetch exceeds configured timeout', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    await expect(loadComponent('/slow/widget.html', { timeout: 25 })).rejects.toThrow(
      /Timed out loading component/i,
    );

    fetchSpy.mockRestore();
  });
});
