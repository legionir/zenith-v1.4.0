// #47 — زیرساخت هشدار deprecation یک‌باره با کد ZEN-DEPR-xxx.
// قرمز قبل از رفع: deprecate() هنوز در @zenith/errors وجود ندارد.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deprecate, resetDeprecationWarnings } from '../src/index';

describe('deprecate() (#47)', () => {
  let calls: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
  });

  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('warns once per code with ZEN-DEPR code, old and replacement names', () => {
    deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    expect(calls.filter((c) => c.includes('ZEN-DEPR-001'))).toHaveLength(1);
    expect(calls[0]).toContain('processVirtualList');
    expect(calls[0]).toContain('createVirtualList');
  });

  it('separate codes warn independently', () => {
    deprecate('ZEN-DEPR-002', 'enterTransition', 'createTransition');
    deprecate('ZEN-DEPR-003', 'leaveTransition', 'createTransition');
    expect(calls.filter((c) => c.includes('ZEN-DEPR-'))).toHaveLength(2);
  });

  it('is silent in production (__ZENITH_DEV__ === false)', () => {
    (globalThis as any).__ZENITH_DEV__ = false;
    deprecate('ZEN-DEPR-010', 'oldThing', 'newThing');
    expect(calls).toHaveLength(0);
  });

  it('extra hint text is included when provided', () => {
    deprecate('ZEN-DEPR-011', 'animateGroup', 'createTransition', 'use stagger via CSS');
    expect(calls[0]).toContain('use stagger via CSS');
  });
});
