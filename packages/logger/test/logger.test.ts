// #143 — @zenith/logger (SPEC §۲.۳): رفتار بنیادی createLogger/Logger.
//
// معیارهای پذیرش پوشش‌داده‌شده در این فایل:
//   • فیلتر سطح (پیش‌فرض dev=debug / prod=warn بر پایهٔ __ZENITH_DEV__)
//   • level:'silent' ⇒ هیچ خروجی‌ای (بند اول معیارها)
//   • redact: کلیدهای token/password/authorization/secret/cookie در details
//   • child scopeها با «:» به هم می‌پیوندند (فرمت `[zen:scope]`)
//   • logger.error(zenithError) ⇒ کد + پیام + suggestion (بند «خطا» SPEC §۲.۳)
//   • clock قابل جایگزینی؛ warnOnce یک‌بار در هر نمونه؛ dispose قرارداد §۰.۱
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import { createLogger, bufferSink } from '../src/index';

describe('createLogger — levels (#143)', () => {
  it('captures debug/info/warn/error with correct level and default scope "zen"', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    const entries = buf.entries();
    expect(entries.map((e) => e.level)).toEqual(['debug', 'info', 'warn', 'error']);
    expect(entries.every((e) => e.scope === 'zen')).toBe(true);
    log.dispose();
  });

  it('level "silent" produces zero sink calls for every method', () => {
    const buf = bufferSink();
    const log = createLogger({ level: 'silent', sinks: [buf] });
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    expect(buf.entries()).toEqual([]);
    expect(log.isEnabled('error')).toBe(false);
    log.dispose();
  });

  it('level "warn" drops debug/info but keeps warn/error; isEnabled mirrors rank', () => {
    const buf = bufferSink();
    const log = createLogger({ level: 'warn', sinks: [buf] });
    log.debug('drop');
    log.info('drop');
    log.warn('keep1');
    log.error('keep2');
    expect(buf.entries().map((e) => e.message)).toEqual(['keep1', 'keep2']);
    expect(log.isEnabled('debug')).toBe(false);
    expect(log.isEnabled('info')).toBe(false);
    expect(log.isEnabled('warn')).toBe(true);
    expect(log.isEnabled('error')).toBe(true);
    expect(log.isEnabled('silent')).toBe(false);
    log.dispose();
  });

  it('default level: dev ⇒ debug؛ prod (__ZENITH_DEV__ === false) ⇒ warn', () => {
    const bufDev = bufferSink();
    const dev = createLogger({ sinks: [bufDev] });
    dev.debug('dev-visible');
    expect(bufDev.entries().map((e) => e.message)).toEqual(['dev-visible']);
    dev.dispose();

    (globalThis as Record<string, unknown>).__ZENITH_DEV__ = false;
    try {
      const bufProd = bufferSink();
      const prod = createLogger({ sinks: [bufProd] });
      prod.debug('prod-dropped');
      prod.info('prod-dropped');
      prod.warn('prod-visible');
      expect(bufProd.entries().map((e) => e.message)).toEqual(['prod-visible']);
      prod.dispose();
    } finally {
      delete (globalThis as Record<string, unknown>).__ZENITH_DEV__;
    }
  });
});

describe('createLogger — child scopes (#143)', () => {
  it('child/grandchild scopes join with ":" (format [zen:scope] …)', () => {
    const buf = bufferSink();
    const root = createLogger({ scope: 'zen', sinks: [buf] });
    root.info('r');
    const kid = root.child('dialog');
    kid.info('k');
    kid.child('item').info('g');
    expect(buf.entries().map((e) => e.scope)).toEqual(['zen', 'zen:dialog', 'zen:dialog:item']);
    root.dispose();
  });

  it('child shares parent sinks and level', () => {
    const buf = bufferSink();
    const root = createLogger({ level: 'error', sinks: [buf] });
    const kid = root.child('k');
    kid.warn('dropped');
    kid.error('kept');
    expect(buf.entries().map((e) => e.message)).toEqual(['kept']);
    root.dispose();
  });

  it('child of custom scope: non-"zen" root prefixes as given', () => {
    const buf = bufferSink();
    const root = createLogger({ scope: 'myapp', sinks: [buf] });
    root.child('db').info('x');
    expect(buf.entries()[0]!.scope).toBe('myapp:db');
    root.dispose();
  });
});

describe('createLogger — redact (#143)', () => {
  it('covers the five SPEC keys anywhere in details (nested + arrays), case-insensitive', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.info('payload', {
      keep: 1,
      token: 'T',
      Password: 'P',
      authorization: 'A',
      nested: { secret: 'S', safe: 2 },
      list: [{ cookie: 'C', ok: true }],
    });
    const details = buf.entries()[0]!.details!;
    expect(details).toMatchObject({
      keep: 1,
      token: '***',
      Password: '***',
      authorization: '***',
      nested: { secret: '***', safe: 2 },
      list: [{ cookie: '***', ok: true }],
    });
    expect(JSON.stringify(details)).not.toContain('"T"');
    log.dispose();
  });

  it('custom redact list replaces the default', () => {
    const buf = bufferSink();
    const log = createLogger({ redact: ['ssn'], sinks: [buf] });
    log.info('x', { ssn: '123', token: 'plain-ok' });
    expect(buf.entries()[0]!.details).toEqual({ ssn: '***', token: 'plain-ok' });
    log.dispose();
  });

  it('cyclic details never crash (replaced with [Circular])', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    const cycle: Record<string, unknown> = { a: 1 };
    cycle['self'] = cycle;
    expect(() => log.info('c', cycle)).not.toThrow();
    expect(buf.entries()[0]!.details).toEqual({ a: 1, self: '[Circular]' });
    log.dispose();
  });
});

describe('logger.error(zenithError) — code/message/suggestion (#143)', () => {
  const err = new ZenithError({
    code: 'ZEN-1090',
    category: 'Internal',
    message: 'boom',
    suggestion: 'fix it',
    details: { k: 1 },
  });

  it('entry carries code, message, suggestion and merged details', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.error(err);
    const e = buf.entries()[0]!;
    expect(e.code).toBe('ZEN-1090');
    expect(e.message).toBe('boom');
    expect(e.suggestion).toBe('fix it');
    expect(e.details).toMatchObject({ k: 1 });
    log.dispose();
  });

  it('explicit details argument overrides error.details keys', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.error(err, { k: 2, extra: true });
    expect(buf.entries()[0]!.details).toMatchObject({ k: 2, extra: true });
    log.dispose();
  });

  it('plain Error keeps message without code; string message stays plain', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.error(new Error('plain'));
    log.warn('text');
    const [a, b] = buf.entries();
    expect(a!.message).toBe('plain');
    expect(a!.code).toBeUndefined();
    expect(b!.message).toBe('text');
    log.dispose();
  });
});

describe('createLogger — clock & warnOnce (#143)', () => {
  it('clock option controls entry timestamps', () => {
    const buf = bufferSink();
    let t = 1000;
    const log = createLogger({ sinks: [buf], clock: () => t++ });
    log.info('a');
    log.info('b');
    expect(buf.entries().map((e) => e.t)).toEqual([1000, 1001]);
    log.dispose();
  });

  it('warnOnce logs only once per key (per instance)', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.warnOnce('k', 'first');
    log.warnOnce('k', 'second');
    log.warnOnce('other', 'other-msg');
    expect(buf.entries().map((e) => e.message)).toEqual(['first', 'other-msg']);
    log.dispose();
  });

  it('warnOnce sets are per-instance, not global', () => {
    const bufA = bufferSink();
    const bufB = bufferSink();
    const a = createLogger({ sinks: [bufA] });
    const b = createLogger({ sinks: [bufB] });
    a.warnOnce('same', 'from-a');
    b.warnOnce('same', 'from-b');
    expect(bufA.entries()).toHaveLength(1);
    expect(bufB.entries()).toHaveLength(1);
    a.dispose();
    b.dispose();
  });
});

describe('dispose contract (SPEC §۰.۱)', () => {
  it('dispose removes sinks; logging afterwards is a safe no-op', () => {
    const buf = bufferSink();
    const log = createLogger({ sinks: [buf] });
    log.info('before');
    log.dispose();
    log.info('after');
    expect(buf.entries().map((e) => e.message)).toEqual(['before']);
  });

  it('dispose is idempotent', () => {
    const log = createLogger({ sinks: [bufferSink()] });
    log.dispose();
    expect(() => log.dispose()).not.toThrow();
  });
});
