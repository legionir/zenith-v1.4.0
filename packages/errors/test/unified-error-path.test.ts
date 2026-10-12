// @vitest-environment node
//
// #115 — معیار پذیرش: «یک تست یکپارچه نشان می‌دهد خطای directive/effect/
// scheduler به همان listener می‌رسد.»
//
// هر سه مسیر باید به واحد‌ترین sink (`onError` در @zenith/errors) برسند و در
// یک history مشترک ثبت شوند؛ دیگر هیچ سیستم موازی‌ای وجود ندارد.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ZenithError,
  onError,
  getErrorHistory,
  clearErrorHistory,
  clearErrorHandlers,
  setErrorLogger,
  ErrorCode,
} from '@zenith/errors';
import { signal, effect, onEffectError } from '@zenith/state';
import { scheduleEffect, flushSync, clearScheduler } from '@zenith/scheduler';
import { reportError } from '@zenith/error-boundary';

describe('#115 unified error path (integration)', () => {
  let seen: ZenithError[];
  let off: () => void;

  beforeEach(() => {
    clearErrorHistory();
    clearErrorHandlers();
    setErrorLogger(() => {}); // سکوت log در تست؛ فقط listener شمرده می‌شود.
    seen = [];
    off = onError((e) => seen.push(e));
    // effect بدون handler سراسری، خطای initial-run را rethrow می‌کند (رفتار
    // از پیش موجود). برای ایزوله‌سازی تست، آن را می‌بلعیم؛ emitError همچنان
    // قبل از rethrow روی hub صدا زده می‌شود.
    onEffectError(() => {});
  });
  afterEach(() => {
    onEffectError(null);
    off();
    clearErrorHistory();
    clearErrorHandlers();
    setErrorLogger(null);
    clearScheduler();
  });

  it('directive path (error-boundary reportError) reaches the hub listener', () => {
    // directiveها دقیقاً همین تابعی را صدا می‌زنند که قبلاً listener محلی داشت.
    reportError(new Error('directive boom'), 'expression', { expression: 'a+b' });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.message).toBe('directive boom');
    expect(seen[0]!.source).toBe('expression');
    expect(seen[0]!.code).toBe(ErrorCode.INTERNAL_RUNTIME_FAILURE);
  });

  it('effect path reaches the same listener as the directive path', () => {
    reportError(new Error('from-directive'), 'directive');
    const s = signal(0);
    effect(() => {
      s.get();
      throw new Error('from-effect');
    });

    const messages = getErrorHistory().map((e) => e.message);
    expect(messages).toContain('from-directive');
    expect(messages).toContain('from-effect');
    // همان listener، همان آبجکت‌ها:
    expect(seen.map((e) => e.message)).toEqual(
      expect.arrayContaining(['from-directive', 'from-effect']),
    );
    // همه یک کلاس‌اند:
    for (const e of seen) expect(e).toBeInstanceOf(ZenithError);
  });

  it('scheduler path (task throwing inside flush) reaches the same listener', () => {
    scheduleEffect(() => {
      throw new Error('from-scheduler');
    });
    flushSync();
    expect(seen.map((e) => e.message)).toContain('from-scheduler');
    expect(seen[0]!.code).toBe(ErrorCode.INTERNAL_REACTIVITY_FAILURE);
    expect(seen[0]!.context?.source).toBe('scheduler');
  });

  it('all three sources share one history and one ZenithError model', () => {
    reportError(new Error('e1'), 'directive');
    scheduleEffect(() => {
      throw new Error('e2');
    });
    flushSync();
    const s = signal(0);
    effect(() => {
      s.get();
      throw new Error('e3');
    });

    expect(seen).toHaveLength(3);
    expect(getErrorHistory()).toHaveLength(3);
    for (const e of seen) {
      expect(e).toBeInstanceOf(ZenithError);
      expect(e.code).toMatch(/^ZEN-\d{3}$/);
      expect(e.timestamp).toBeTypeOf('number');
    }
  });

  it('errorSignal (error-boundary) mirrors hub errors — no second listener system', async () => {
    const { errorSignal } = await import('@zenith/error-boundary');
    reportError(new Error('sig-me'), 'expression');
    expect(errorSignal.get()?.message).toBe('sig-me');
  });
});
