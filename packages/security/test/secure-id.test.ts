//
// #64 — secureId(): شناسه‌ی امن با crypto.getRandomValues؛ خطای ZenithError
// در نبود crypto (هیچ fallback غیرامن با Math.random وجود ندارد).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { secureId } from '../src/secure-id';
import { isZenithError } from '@zenith/errors';

describe('secureId (#64)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a hex id of the requested byte length', () => {
    const id = secureId(8);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('uses crypto.getRandomValues, never Math.random', () => {
    const spy = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) & 0xff;
      return arr;
    });
    vi.stubGlobal('crypto', { getRandomValues: spy });
    const mathRandom = vi.spyOn(Math, 'random');
    const id = secureId(4);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    mathRandom.mockRestore();
  });

  it('is unique across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(secureId());
    expect(seen.size).toBe(200);
  });

  it('throws a ZenithError when crypto is unavailable (no insecure fallback)', () => {
    vi.stubGlobal('crypto', undefined);
    let caught: unknown;
    try {
      secureId();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isZenithError(caught)).toBe(true);
  });
});
