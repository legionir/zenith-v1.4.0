// #187: brand «readable» روی Signal/Computed و نوع‌گاردها.
import { describe, it, expect } from 'vitest';
import { signal, computed, isReadable, isWritable, ZENITH_READABLE } from '@zenith/state';

describe('readable brand (#187)', () => {
  it('isReadable accepts Signal and Computed (get-only)', () => {
    expect(isReadable(signal(1))).toBe(true);
    expect(isReadable(computed(() => 1))).toBe(true);
  });

  it('isWritable requires set', () => {
    expect(isWritable(signal(1))).toBe(true);
    expect(isWritable(computed(() => 1))).toBe(false);
  });

  it('non-signals are not readable (services, primitives, null)', () => {
    expect(isReadable({ fetch: () => {} })).toBe(false);
    expect(isReadable(42)).toBe(false);
    expect(isReadable('str')).toBe(false);
    expect(isReadable(null)).toBe(false);
    expect(isReadable(undefined)).toBe(false);
  });

  it('legacy duck-typed get+set objects still count as readable', () => {
    expect(isReadable({ get: () => 1, set: () => {} })).toBe(true);
  });

  it('brand lives on the prototype via Symbol.for (cross-build stable)', () => {
    expect((signal(1) as any)[ZENITH_READABLE]).toBe(true);
    expect((computed(() => 1) as any)[ZENITH_READABLE]).toBe(true);
    expect(ZENITH_READABLE).toBe(Symbol.for('zenith.readable'));
  });
});
