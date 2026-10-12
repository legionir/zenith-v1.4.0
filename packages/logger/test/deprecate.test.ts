// #143 — deprecate()/warnOnce سراسری: یک‌بار در هر فرآیند + سکوت prod.
//
// کدهای ZEN-DEPR-xxx از رجیستری errors (DEC-019/#47) خوانده می‌شوند؛
// نام ثبت‌نشده ⇒ کد پیش‌کنج ZEN-DEPR-999. برای ایزوله‌سازی تست، هر it
// نام API منحصربه‌فرد مصرف می‌کند (dedupe سراسری است و عمداً Set تست‌پذیر
// ندارد — همان رفتار «یک‌بار در فرآیند» محصول است).
import { describe, it, expect } from 'vitest';
import { createLogger, deprecate, warnOnce, bufferSink } from '../src/index';

describe('deprecate(oldName, newName, since) (#143)', () => {
  it('registered code ZEN-DEPR-001: دو فراخوانی ⇒ دقیقاً یک هشدار (معیار پذیرش)', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    deprecate('processVirtualList', 'createVirtualList', '1.4.0', { logger: log });
    deprecate('processVirtualList', 'createVirtualList', '1.4.0', { logger: log });
    const warnings = buf.entries().filter((e) => e.level === 'warn');
    expect(warnings).toHaveLength(1);
    const e = warnings[0]!;
    // کد در متن هشدار است (این warn یک ZenithError نیست) + scope فرزند.
    expect(e.message).toContain('ZEN-DEPR-001');
    expect(e.message).toContain('processVirtualList');
    expect(e.message).toContain('createVirtualList');
    expect(e.message).toContain('1.4.0');
    expect(e.scope).toBe('zen:deprecate');
    log.dispose();
  });

  it('نام ثبت‌نشده ⇒ کد پیش‌کنج ZEN-DEPR-999 با details کامل', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    deprecate('legacyTween', 'tween', '1.5.0', { logger: log });
    const e = buf.entries()[0]!;
    expect(e.level).toBe('warn');
    expect(e.message).toContain('ZEN-DEPR-999');
    expect(e.message).toContain('legacyTween');
    expect(e.message).toContain('tween');
    expect(e.message).toContain('1.5.0');
    expect(e.scope).toBe('zen:deprecate');
    log.dispose();
  });

  it('__ZENITH_DEV__ === false ⇒ کاملاً خاموش', () => {
    (globalThis as Record<string, unknown>).__ZENITH_DEV__ = false;
    try {
      const buf = bufferSink();
      const log = createLogger({ sinks: [buf] });
      deprecate('prodQuiet', 'whatever', '1.5.0', { logger: log });
      expect(buf.entries()).toEqual([]);
      log.dispose();
    } finally {
      delete (globalThis as Record<string, unknown>).__ZENITH_DEV__;
    }
  });
});

describe('warnOnce(key, msg) سراسری (#143)', () => {
  it('یک هشدار به‌ازای هر key (حتی پیام متفاوت)', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    warnOnce('solo-key', 'first', { logger: log });
    warnOnce('solo-key', 'second-different', { logger: log });
    warnOnce('other-key', 'other', { logger: log });
    expect(buf.entries().map((e) => e.message)).toEqual(['first', 'other']);
    expect(buf.entries().every((e) => e.level === 'warn')).toBe(true);
    log.dispose();
  });
});
