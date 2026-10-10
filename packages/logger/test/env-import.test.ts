// #143 — هیچ دسترسی به window/document هنگام import (الگوی env-import در #141).
// environment پیش‌فرض node: اگر src در سطح ماژول به DOM دست بزند ⇒ ReferenceError.
import { describe, it, expect } from 'vitest';

describe('@zenith/logger import in pure Node (#143)', () => {
  it('imports without touching window/document at module load', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.createLogger).toBe('function');
    expect(typeof mod.consoleSink).toBe('function');
    expect(typeof mod.bufferSink).toBe('function');
    expect(typeof mod.beaconSink).toBe('function');
    expect(typeof mod.warnOnce).toBe('function');
    expect(typeof mod.deprecate).toBe('function');
    expect(typeof mod.setLogLevel).toBe('function');
    expect(typeof mod.addSink).toBe('function');
    expect(typeof mod.logger).toBe('object');
    // beaconSink نباید در node هنگام ساخت timer جهانی بسازد (فقط flushLazy).
    const log = mod.createLogger({ level: 'silent', sinks: [mod.bufferSink()] });
    expect(log.isEnabled('error')).toBe(false);
    log.dispose();
  });
});
