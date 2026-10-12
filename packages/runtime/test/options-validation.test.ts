// @vitest-environment jsdom
// #52 — اعتبارسنجی گزینه‌های @zenith/runtime در مرز ورودی (ZenStartOptions)
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import { Zen, ZEN_START_OPTIONS_DEFAULTS, resolveZenStartOptions } from '../src/index';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

describe('@zenith/runtime ZenStartOptions validation (#52)', () => {
  it('exports frozen ZEN_START_OPTIONS_DEFAULTS and resolves defaults', () => {
    expect(Object.isFrozen(ZEN_START_OPTIONS_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(ZEN_START_OPTIONS_DEFAULTS.ssr)).toBe(true);
    expect(resolveZenStartOptions()).toEqual({
      devtools: true,
      ssr: {
        preloadState: true,
        validateHydration: false,
      },
      strictParity: false,
    });
  });

  it('rejects invalid types, invalid delegationRoot, and unknown keys on Zen.start()', () => {
    const root = document.createElement('div');

    const devtoolsErr = catchError(() => Zen.start(root, {}, { devtools: 'no' as any }));
    expect(devtoolsErr.code).toBe('ZEN-1001');
    expect((devtoolsErr.details as any).path).toBe('devtools');

    const rootErr = catchError(() =>
      Zen.start(root, {}, { delegationRoot: { nodeType: 3 } as any }),
    );
    expect(rootErr.code).toBe('ZEN-1001');
    expect((rootErr.details as any).path).toBe('delegationRoot');

    const ssrErr = catchError(() => Zen.start(root, {}, { ssr: { preloadState: 'true' as any } }));
    expect(ssrErr.code).toBe('ZEN-1001');
    expect((ssrErr.details as any).path).toBe('ssr.preloadState');

    const unknownErr = catchError(() => Zen.start(root, {}, { debugMode: true } as any));
    expect(unknownErr.code).toBe('ZEN-1002');
    expect((unknownErr.details as any).path).toBe('debugMode');
  });
});
