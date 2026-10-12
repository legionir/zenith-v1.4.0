// @vitest-environment node
//
// #115 — تست‌های واحد hub خطا در @zenith/errors (DEC-031).
// runner: vitest (DEC-002). بدون زمان/شبکهٔ واقعی؛ deterministic.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ZenithError,
  onError,
  emitError,
  reportError,
  getErrorHistory,
  clearErrorHistory,
  clearErrorHandlers,
  setErrorLogger,
  setDevMode,
  isDevMode,
  ErrorCode,
  isZenithError,
} from '../src/index';

describe('errors hub (#115)', () => {
  beforeEach(() => {
    clearErrorHistory();
    clearErrorHandlers();
    setErrorLogger(null);
    setDevMode(false);
  });
  afterEach(() => {
    setErrorLogger(null);
    setDevMode(false);
    clearErrorHandlers();
    clearErrorHistory();
  });

  it('onError returns an idempotent cleanup', () => {
    const seen: ZenithError[] = [];
    const off = onError((e) => seen.push(e));
    emitError(new ZenithError({ code: 'ZEN-901', category: 'Internal', message: 'a' }));
    expect(seen).toHaveLength(1);
    off();
    off(); // idempotent — نباید throw کند
    emitError(new ZenithError({ code: 'ZEN-901', category: 'Internal', message: 'b' }));
    expect(seen).toHaveLength(1);
  });

  it('same handler registered twice fires once (Set semantics)', () => {
    let n = 0;
    const h = () => {
      n++;
    };
    onError(h);
    onError(h);
    emitError(new ZenithError({ code: 'ZEN-901', category: 'Internal', message: 'x' }));
    expect(n).toBe(1);
  });

  it('emitError normalizes a partial input to a coded ZenithError', () => {
    const err = emitError({ message: 'bad', category: 'expression', severity: 'warning' });
    expect(err).toBeInstanceOf(ZenithError);
    expect(err.code).toBe(ErrorCode.INTERNAL_RUNTIME_FAILURE);
    expect(err.category).toBe('Expression');
    expect(err.severity).toBe('warning');
    expect(err.timestamp).toBeTypeOf('number');
    expect(isZenithError(err)).toBe(true);
  });

  it('history is circular and capped at 50', () => {
    for (let i = 0; i < 60; i++) {
      emitError(new ZenithError({ code: 'ZEN-901', category: 'Internal', message: `e${i}` }));
    }
    const h = getErrorHistory();
    expect(h).toHaveLength(50);
    expect(h[0]!.message).toBe('e10');
  });

  it('a throwing handler does not stop the rest and does not re-enter the hub', () => {
    const received: string[] = [];
    setErrorLogger((sev, title) => received.push(`${sev}:${title}`));
    const off1 = onError(() => {
      throw new Error('handler broke');
    });
    const off2 = onError((e) => received.push(`ok:${e.message}`));
    expect(() =>
      emitError(new ZenithError({ code: 'ZEN-901', category: 'Internal', message: 'boom' })),
    ).not.toThrow();
    expect(received).toContain('ok:boom');
    expect(received.some((r) => r.startsWith('error:'))).toBe(true);
    off1();
    off2();
  });

  it('reportError enriches with source/expression/element and hits the same listener', () => {
    const seen: ZenithError[] = [];
    const off = onError((e) => seen.push(e));
    const el = { nodeType: 1 } as unknown as HTMLElement;
    reportError(new Error('directive blew up'), 'expression', { expression: 'a + b', element: el });
    expect(seen).toHaveLength(1);
    const e = seen[0]!;
    expect(e.code).toBe(ErrorCode.INTERNAL_RUNTIME_FAILURE);
    expect(e.category).toBe('Runtime');
    expect(e.source).toBe('expression');
    expect(e.expression).toBe('a + b');
    expect(e.element).toBe(el);
    off();
  });

  it('reportError passes an existing ZenithError through unchanged (same instance)', () => {
    const seen: ZenithError[] = [];
    const off = onError((e) => seen.push(e));
    const original = new ZenithError({ code: 'ZEN-001', category: 'Expression', message: 'keep' });
    reportError(original, 'directive');
    expect(seen[0]).toBe(original);
    expect(seen[0]!.code).toBe('ZEN-001');
    off();
  });

  it('devMode routes rich logs through the injected sink', () => {
    const logs: Array<{ sev: string; title: string; payload?: Record<string, unknown> }> = [];
    setErrorLogger((sev, title, payload) => logs.push({ sev, title, payload }));
    setDevMode(true);
    expect(isDevMode()).toBe(true);
    emitError({ message: 'dev', category: 'ssr', severity: 'warning', hint: 'fix it' });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.title).toContain('SSR');
    expect(logs[0]!.payload?.hint).toBe('fix it');
  });

  it('without devMode, info severity is not logged but still recorded', () => {
    const logs: string[] = [];
    setErrorLogger((sev) => logs.push(sev));
    emitError({ message: 'quiet', category: 'runtime', severity: 'info' });
    expect(logs).toHaveLength(0);
    expect(getErrorHistory().some((e) => e.message === 'quiet')).toBe(true);
  });
});
