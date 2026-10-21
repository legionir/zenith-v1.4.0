// @vitest-environment jsdom
//
// #116 — processFetch باید Cleanup idempotent برگرداند (قبلاً void بود؛
// acceptance #116: «همهٔ process* نوع بازگشتی () => void دارند»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { processFetch } from '../src/fetcher';

/** context مشابه createContext رانتایم: $url getter روی signal. */
function makeCtx(url: ReturnType<typeof signal<string>>): Record<string, any> {
  const ctx: Record<string, any> = {};
  Object.defineProperty(ctx, '$url', {
    get: () => url.get(),
    enumerable: true,
    configurable: true,
  });
  return ctx;
}

describe('#116 processFetch cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ hello: 'world' }),
        text: async () => '{"hello":"world"}',
        headers: new Map(),
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an idempotent Cleanup that stops the effect; also fills disposes[]', () => {
    const $url = signal('https://api.example.test/items');
    const fetchMock = vi.mocked(fetch);
    const disposes: (() => void)[] = [];
    const cleanup = processFetch(
      document.createElement('div'),
      '$url',
      makeCtx($url),
      (_n: HTMLElement, _c: Record<string, any>, _d: (() => void)[]) => {},
      disposes,
    );
    flushSync();
    expect(typeof cleanup).toBe('function');
    expect(disposes).toHaveLength(1); // سازگاری با آرایهٔ والد
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    cleanup();
    cleanup(); // idempotent — نباید throw کند
    $url.set('https://api.example.test/other'); // effect disposed ⇒ fetch جدید نباید زده شود
    flushSync();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});
