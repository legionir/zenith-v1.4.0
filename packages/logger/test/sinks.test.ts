// #143 — sinkها: bufferSink / beaconSink / consoleSink(سرور) + محافظ sink خراب.
//
// در environment پیش‌فرض node اجرا می‌شود: مسیر «سرور» consoleSink (JSON
// خط‌به‌خط با requestId) همین‌جا پوشانه داده می‌شود؛ مسیر مرورگر در
// console-sink.test.ts (jsdom).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger, bufferSink, beaconSink, consoleSink } from '../src/index';
import type { LogEntry } from '../src/index';

describe('bufferSink (#143)', () => {
  it('maxEntries drops the oldest (ring behaviour)', () => {
    const buf = bufferSink({ maxEntries: 3 });
    for (let i = 1; i <= 5; i++) void buf({ level: 'info', scope: 'zen', message: `m${i}`, t: i });
    expect(buf.entries().map((e) => e.message)).toEqual(['m3', 'm4', 'm5']);
  });

  it('default maxEntries is 100 (devtools-friendly cap)', () => {
    const buf = bufferSink();
    for (let i = 0; i < 150; i++) void buf({ level: 'info', scope: 'zen', message: `m${i}`, t: i });
    expect(buf.entries()).toHaveLength(100);
    expect(buf.entries()[0]!.message).toBe('m50');
  });

  it('clear() empties; entries() returns a defensive copy', () => {
    const buf = bufferSink();
    void buf({ level: 'info', scope: 'zen', message: 'a', t: 1 });
    const snapshot = buf.entries();
    snapshot.push({ level: 'info', scope: 'x', message: 'injected', t: 2 });
    expect(buf.entries()).toHaveLength(1);
    buf.clear();
    expect(buf.entries()).toEqual([]);
  });
});

describe('beaconSink (#143)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('batches up to batchSize then POSTs ndjson with merged headers', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const sink = beaconSink({
      url: 'https://logs.example/ingest',
      batchSize: 2,
      flushInterval: 10_000,
      headers: { 'x-api-key': 'k' },
    });
    const log = createLogger({ sinks: [sink] });
    log.info('one');
    log.info('two');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://logs.example/ingest');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-ndjson; charset=utf-8',
    );
    const lines = String(init.body)
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines.map((l) => l.msg)).toEqual(['one', 'two']);
    log.dispose();
    sink.dispose();
  });

  it('flushInterval sends partial batches on a timer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const sink = beaconSink({ url: 'https://x/y', batchSize: 10, flushInterval: 500 });
    const log = createLogger({ sinks: [sink] });
    log.warn('partial');
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    log.dispose();
    sink.dispose();
  });

  it('dispose flushes pending entries; a failing fetch never throws into the app', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    const sink = beaconSink({ url: 'https://x/y', batchSize: 5, flushInterval: 60_000 });
    const log = createLogger({ sinks: [sink] });
    log.info('pending');
    log.dispose(); // باید flush را صدا بزند
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]!.body).toContain('pending');
    sink.dispose();
  });
});

describe('consoleSink — server mode (#143)', () => {
  it('emits one line-delimited JSON object per entry with requestId when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sink = consoleSink({ requestId: () => 'req-42' });
    void sink({ level: 'warn', scope: 'zen:db', message: 'slow query', code: 'ZEN-1091', t: 7 });
    void sink({ level: 'info', scope: 'zen', message: 'plain', t: 8 });
    expect(spy).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(spy.mock.calls[0]![0]));
    expect(first).toMatchObject({
      ts: 7,
      level: 'warn',
      scope: 'zen:db',
      msg: 'slow query',
      code: 'ZEN-1091',
      requestId: 'req-42',
    });
    const second = JSON.parse(String(spy.mock.calls[1]![0]));
    expect(second.requestId).toBe('req-42');
    spy.mockRestore();
  });

  it('without the requestId option no requestId field is emitted (and null ⇒ omitted)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const plain = consoleSink();
    void plain({ level: 'info', scope: 'zen', message: 'no-id', t: 1 });
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).not.toHaveProperty('requestId');
    const nullable = consoleSink({ requestId: () => null });
    void nullable({ level: 'info', scope: 'zen', message: 'null-id', t: 2 });
    expect(JSON.parse(String(spy.mock.calls[1]![0]))).not.toHaveProperty('requestId');
    spy.mockRestore();
  });

  it('redacted details survive into the JSON line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger({ sinks: [consoleSink()], level: 'info' });
    log.info('login', { user: 'bob', password: 'hunter2' });
    const out = JSON.parse(String(spy.mock.calls[0]![0]));
    expect(out.details).toEqual({ user: 'bob', password: '***' });
    log.dispose();
    spy.mockRestore();
  });
});

describe('broken sink guard — ZEN-1091 (#143)', () => {
  it('a throwing sink never breaks the app and is reported once via healthy sinks', () => {
    const calls: number[] = [];
    const broken = (entry: LogEntry) => {
      calls.push(1);
      throw new Error(`sink boom: ${entry.message}`);
    };
    const healthy = bufferSink();
    const log = createLogger({ sinks: [broken, healthy] });
    log.warn('first');
    log.warn('second');
    log.warn('third');
    expect(() => log.warn('fourth')).not.toThrow();
    // فقط فراخوان اول به sink خراب رفته (غیرفعال شده) — حلقهٔ لاگ نداریم.
    expect(calls).toHaveLength(1);
    const reported = healthy.entries().filter((e) => e.code === 'ZEN-1091');
    expect(reported).toHaveLength(1);
    expect(reported[0]!.suggestion).toContain('sink');
    // لاگ‌های بعدی کاربر همچنان به sink سالم می‌رسند.
    expect(healthy.entries().filter((e) => e.message.startsWith('second'))).toHaveLength(1);
    log.dispose();
  });

  it('broken sink removal via addSink Cleanup stops reports entirely', () => {
    const broken = () => {
      throw new Error('nope');
    };
    const healthy = bufferSink();
    const log = createLogger({ sinks: [healthy] });
    const remove = log.addSink(broken);
    log.warn('a');
    remove();
    log.warn('b');
    expect(healthy.entries().filter((e) => e.code === 'ZEN-1091')).toHaveLength(1);
    log.dispose();
  });

  it('a sink that only ever fails (no healthy sinks) still never throws', () => {
    const log = createLogger({ sinks: [() => Promise.reject(new Error('async boom'))] });
    expect(() => {
      log.error('x');
      log.warn('y');
    }).not.toThrow();
    log.dispose();
  });
});
