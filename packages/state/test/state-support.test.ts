// #27 tests for @zenith/state support modules: error system, devtools registry.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '@zenith/logger';
import {
  onError,
  emitError,
  getErrorHistory,
  clearErrorHistory,
  errorBoundary,
  setErrorLogger,
  setDevMode,
  isDevMode,
} from '@zenith/state';
import {
  signal,
  registerSignal,
  getAllSignals,
  getSignalInfo,
  getStateTimeline,
  onStateChange,
  nameSignal,
  clearRegistry,
} from '@zenith/state';

describe('error system (#115 model)', () => {
  beforeEach(() => clearErrorHistory());

  it('emitError stores history and notifies handlers', () => {
    const seen: any[] = [];
    const off = onError((e) => seen.push(e));
    const err = emitError({
      message: 'boom',
      category: 'reactivity',
      severity: 'error',
      recoverable: false,
    });
    expect(err.timestamp).toBeTypeOf('number');
    expect(seen).toHaveLength(1);
    expect(getErrorHistory().map((e) => e.message)).toContain('boom');
    off();
    emitError({ message: 'after', category: 'runtime', severity: 'warning', recoverable: true });
    expect(seen).toHaveLength(1); // unregistered
  });

  it('a throwing handler does not break emitError', () => {
    // #39: emitError handler-failure از طریق logger.error گزارش می‌شود (نه
    // console.error) — همان هدف نظارتی: تابع باید بدون throw بیرون بیاید.
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const off = onError(() => {
      throw new Error('handler broke');
    });
    expect(() =>
      emitError({ message: 'ok', category: 'ssr', severity: 'info', recoverable: true }),
    ).not.toThrow();
    off();
    spy.mockRestore();
  });

  it('history is capped at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      emitError({ message: `e${i}`, category: 'expression', severity: 'info', recoverable: true });
    }
    const h = getErrorHistory();
    expect(h.length).toBe(50);
    expect(h[0]!.message).toBe('e10');
  });

  it('errorBoundary catches and routes errors', () => {
    const fn = errorBoundary(() => {
      throw new Error('inner');
    }, 'directive');
    expect(fn()).toBeUndefined();
    // #115: مدل واحد — category رشته‌ای قدیمی ('directive') به Runtime نگاشت
    // می‌شود و ZenithError یک کلاس با code است (نه interface موازی).
    expect(
      getErrorHistory().some(
        (e) => e.message === 'inner' && e.category === 'Runtime' && e.code === 'ZEN-905',
      ),
    ).toBe(true);
    const ok = errorBoundary(() => 42, 'directive');
    expect(ok()).toBe(42);
  });

  it('devMode toggles', () => {
    setDevMode(true);
    expect(isDevMode()).toBe(true);
    // #115: مسیر log از طریق sink تزریق‌پذیر است (بدون console.* مستقیم در hub).
    const logs: Array<{ severity: string; title: string }> = [];
    setErrorLogger((severity, title) => logs.push({ severity, title }));
    emitError({
      message: 'dev',
      category: 'security',
      severity: 'warning',
      hint: 'h',
      context: { a: 1 },
    });
    expect(logs.some((l) => l.severity === 'warning' && l.title.includes('Security'))).toBe(true);
    setErrorLogger(null);
    setDevMode(false);
    expect(isDevMode()).toBe(false);
  });

  it('clearErrorHistory empties history', () => {
    emitError({ message: 'x', category: 'reactivity', severity: 'info', recoverable: true });
    clearErrorHistory();
    expect(getErrorHistory()).toHaveLength(0);
  });
});

describe('devtools registry (#10 Phase 10)', () => {
  const env = globalThis as any;
  beforeEach(() => {
    env.__ZENITH_DEVTOOLS__ = true;
    clearRegistry();
  });
  afterEach(() => {
    delete env.__ZENITH_DEVTOOLS__;
    clearRegistry();
  });

  it('registerSignal assigns stable ids and getAllSignals lists them', () => {
    const s = signal(1);
    const id = registerSignal(s);
    expect(id).toBeGreaterThan(0);
    expect(registerSignal(s)).toBe(id); // same signal → same id
    const all = getAllSignals();
    expect(all.some((si) => si.id === id)).toBe(true);
    expect(getSignalInfo(id)!.id).toBe(id);
  });

  it('recordStateChange appends to timeline and notifies listeners', () => {
    const s = signal(1);
    registerSignal(s, 'sig');
    const seen: any[] = [];
    const off = onStateChange((c) => seen.push(c));
    s.set(2); // Signal.set records the change internally
    const t = getStateTimeline();
    expect(t.length).toBeGreaterThan(0);
    expect(t[t.length - 1]!.newValue).toBe(2);
    expect(seen.length).toBeGreaterThan(0);
    off();
    s.set(3);
    expect(getStateTimeline().at(-1)!.newValue).toBe(3);
  });

  it('nameSignal renames an existing registered signal', () => {
    const s = signal(0);
    const id = registerSignal(s);
    nameSignal(s, 'renamed');
    expect(getSignalInfo(id)!.name).toBe('renamed');
  });

  it('registry is inert when devtools disabled', () => {
    env.__ZENITH_DEVTOOLS__ = false;
    env.__ZENITH_DEV__ = false;
    const s = signal(1);
    expect(registerSignal(s)).toBe(-1);
    expect(getAllSignals()).toEqual([]);
    expect(getStateTimeline()).toEqual([]);
    delete env.__ZENITH_DEV__;
  });
});
