// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@zenith/logger';
import { createAnalytics, type AnalyticsProvider } from '../src/directives/track';

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
afterEach(() => {
  vi.restoreAllMocks();
});

describe('analytics provider failure isolation (#155)', () => {
  it.each(['throw', 'reject'] as const)(
    'reports a provider %s without exposing payloads or interrupting healthy providers',
    async (mode) => {
      const report = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const healthy = vi.fn();
      const failure = new Error('Bearer secret-token and private email');
      const bad: AnalyticsProvider = {
        name: 'private-provider-name',
        send() {
          if (mode === 'throw') throw failure;
          return Promise.reject(failure);
        },
      };
      const analytics = createAnalytics({
        consent: { default: true },
        respectDNT: false,
        providers: [bad, { name: 'healthy', send: healthy }],
      });
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        expect(() =>
          analytics.track('private-event', { token: 'secret-token', email: 'private email' }),
        ).not.toThrow();
        await nextTurn();
        expect(healthy).toHaveBeenCalledTimes(1);
        expect(report).toHaveBeenCalledTimes(1);
        const logged = report.mock.calls[0][0];
        expect(logged).toMatchObject({ code: 'ZEN-1901' });
        const serialized = JSON.stringify(logged);
        expect(serialized).not.toContain('secret-token');
        expect(serialized).not.toContain('private email');
        expect(serialized).not.toContain('private-event');
        expect(serialized).not.toContain('private-provider-name');
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        analytics.dispose();
        process.off('unhandledRejection', unhandled);
      }
    },
  );

  it('handles a delayed rejection after dispose and never sends another event', async () => {
    const report = vi.spyOn(logger, 'error').mockImplementation(() => {});
    let reject!: (reason: unknown) => void;
    const pending = new Promise<void>((_resolve, r) => {
      reject = r;
    });
    const send = vi.fn(() => pending);
    const analytics = createAnalytics({
      consent: { default: true },
      respectDNT: false,
      providers: [{ name: 'pending', send }],
    });
    analytics.page('/account');
    analytics.dispose();
    reject(new Error('late private failure'));
    await nextTurn();
    analytics.identify('private-user');
    expect(send).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch before consent or after consent is revoked', async () => {
    const report = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const send = vi.fn(() => Promise.reject(new Error('must not run')));
    const analytics = createAnalytics({
      respectDNT: false,
      providers: [{ name: 'blocked', send }],
    });
    analytics.track('blocked');
    analytics.setConsent(true);
    analytics.setConsent(false);
    analytics.track('also-blocked');
    await nextTurn();
    expect(send).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    analytics.dispose();
  });

  it('does not turn a broken error reporter into another unhandled rejection', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {
      throw new Error('reporter failed');
    });
    const healthy = vi.fn();
    const analytics = createAnalytics({
      consent: { default: true },
      respectDNT: false,
      providers: [
        { name: 'broken', send: () => Promise.reject(new Error('provider failed')) },
        { name: 'healthy', send: healthy },
      ],
    });
    analytics.track('event');
    await nextTurn();
    expect(healthy).toHaveBeenCalledTimes(1);
    analytics.dispose();
  });
});
