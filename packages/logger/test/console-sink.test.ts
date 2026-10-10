// #143 — مسیر مرورگر consoleSink + فرمت پیش‌فرض `[zen:scope] CODE: message`
// و تابع کمکی `entryText` (exported تا sinkهای سفارشی هم بتوانند رندر کنند).
// jsdom: `shared.isServer()` ⇒ false ⇒ خروجی متنی level‌به‌level در console.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ZenithError } from '@zenith/errors';
import { createLogger, consoleSink, bufferSink } from '../src/index';
import { entryText } from '../src/format';
import type { LogEntry } from '../src/types';
describe('consoleSink — browser text mode (#143)', () => {
  it('routes levels to console.debug/info/warn/error with the default format', () => {
    const d = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const i = vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ level: 'debug', sinks: [consoleSink()] });
    log.debug('dbg');
    log.info('inf');
    log.child('form').warn('wn');
    log.error('err');
    expect(d).toHaveBeenCalledWith('[zen] dbg');
    expect(i).toHaveBeenCalledWith('[zen] inf');
    expect(w).toHaveBeenCalledWith('[zen:form] wn');
    expect(e).toHaveBeenCalledWith('[zen] err');
    log.dispose();
    for (const s of [d, i, w, e]) s.mockRestore();
  });

  it('logger attaches rendered text to every entry (default format = entryText)', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.error('disk full');
    log.child('io').warn('slow');
    const entries = buf.entries();
    expect(entries.map((e) => e.text)).toEqual(['[zen] disk full', '[zen:io] slow']);
    log.dispose();
  });

  it('custom format function replaces the default entirely', () => {
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = createLogger({
      sinks: [consoleSink()],
      format: (entry) => `${entry.level.toUpperCase()}|${entry.scope}|${entry.message}`,
    });
    log.warn('careful');
    expect(w).toHaveBeenCalledWith('WARN|zen|careful');
    log.dispose();
    w.mockRestore();
  });

  it('logger.error(zenithError) prints code AND suggestion (issue: «کد، پیام، suggestion»)', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ sinks: [consoleSink()] });
    log.error(
      new ZenithError({
        code: 'ZEN-1090',
        category: 'Internal',
        message: 'kaboom',
        suggestion: 'try harder',
      }),
    );
    expect(e).toHaveBeenCalledTimes(1);
    const out = String(e.mock.calls[0]![0]);
    expect(out).toContain('[zen] ZEN-1090: kaboom');
    expect(out).toContain('try harder');
    log.dispose();
    e.mockRestore();
  });

  it('entryText renders `[scope] CODE: message` per SPEC §۲.۳', () => {
    const entry: LogEntry = {
      level: 'error',
      scope: 'zen:x',
      message: 'boom',
      code: 'ZEN-1091',
      t: 1,
    };
    expect(entryText(entry)).toBe('[zen:x] ZEN-1091: boom');
    expect(entryText({ level: 'info', scope: 'zen', message: 'plain', t: 1 })).toBe('[zen] plain');
  });
});
