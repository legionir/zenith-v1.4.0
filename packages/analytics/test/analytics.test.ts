// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@zenith/logger';
import { createAnalytics, bindTrack, analyticsPlugin, consoleProvider, beaconProvider, gtagProvider, plausibleProvider } from '../src';
import type { Analytics, AnalyticsEvent } from '../src';

const instances: Analytics[] = [];
beforeEach(() => { vi.spyOn(logger, 'error').mockImplementation(() => {}); });
afterEach(() => { instances.splice(0).forEach(value => value.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
function setup(extra: Parameters<typeof createAnalytics>[0] = {}) {
  const events: AnalyticsEvent[] = [];
  const instance = createAnalytics({ respectDNT: false, sessionIdFactory: () => 'test-session', providers: [consoleProvider(event => { events.push(event); })], ...extra });
  instances.push(instance); return { instance, events };
}

describe('consent-first analytics engine (#155)', () => {
  it('allocates no session/event timer before consent and never replays withheld events', async () => {
    vi.useFakeTimers(); const id = vi.fn(() => 'session');
    const { instance, events } = setup({ sessionIdFactory: id });
    instance.identify('private-user', { password: 'private' });
    expect(id).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    instance.setConsent(true); await instance.flush(); expect(events).toEqual([]);
  });
  it('batches by size/time; revocation immediately discards queued data and the timer', async () => {
    vi.useFakeTimers(); const { instance, events } = setup({ consent: { default: true }, batch: { size: 2, interval: 100 } });
    instance.track('first'); expect(events).toEqual([]); instance.track('second'); expect(events).toHaveLength(2);
    instance.track('private-queued'); instance.setConsent(false); vi.advanceTimersByTime(1000);
    instance.setConsent(true); await instance.flush(); expect(events.map(e => e.name)).toEqual(['first', 'second']); expect(vi.getTimerCount()).toBe(0);
  });
  it('redacts nested keys without mutating the caller or evaluating getters', async () => {
    const { instance, events } = setup({ consent: { default: true } });
    const getter = vi.fn(() => 'private');
    const props = { token: 'secret', nested: { password: 'secret' }, safe: 42 };
    Object.defineProperty(props, 'accessor', { get: getter, enumerable: true });
    instance.track('safe', props); await instance.flush();
    expect(events[0]!.props).toMatchObject({ token: '***', nested: { password: '***' }, safe: 42, accessor: '[Accessor]' });
    expect(getter).not.toHaveBeenCalled(); expect(props.token).toBe('secret'); expect(Object.isFrozen(events[0]!.props)).toBe(true);
  });
  it('isolates throw/reject failures and observes late rejections after disposal', async () => {
    const healthy = vi.fn();
    const instance = createAnalytics({ consent: { default: true }, respectDNT: false, batch: { size: 1, interval: 0 }, sessionIdFactory: () => 'test', providers: [{ name: 'bad', send: () => Promise.reject(new Error('Bearer private-token')) }, { name: 'healthy', send: healthy }] }); instances.push(instance);
    instance.track('private-event', { email: 'private-email' }); instance.dispose(); await instance.flush();
    expect(healthy).toHaveBeenCalledOnce(); expect(logger.error).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(/private-token|private-email|private-event/);
  });
  it('stops provider iteration if a provider disposes the engine mid-flush', () => {
    const second = vi.fn();
    const { instance } = setup({ consent: { default: true }, batch: { size: 1, interval: 0 }, providers: [] });
    instance.use({ name: 'dispose', send: () => instance.dispose() }); instance.use({ name: 'never', send: second });
    instance.track('event'); expect(second).not.toHaveBeenCalled();
  });
  it('preserves provider ownership across duplicate registration and stale cleanup', () => {
    const send = vi.fn(); const provider = { name: 'shared', send };
    const { instance } = setup({ consent: { default: true }, batch: { size: 1, interval: 0 }, providers: [provider] });
    const remove = instance.use(provider); remove(); remove(); instance.track('event'); expect(send).toHaveBeenCalledOnce();
  });
  it('samples deterministically and expires sessions using an injected clock', () => {
    let time = 0, sequence = 0;
    const { instance, events } = setup({ consent: { default: true }, sampleRate: 0.5, random: () => 0.1, now: () => time, sessionTimeout: 100, sessionIdFactory: () => `session-${++sequence}`, batch: { size: 1, interval: 0 } });
    instance.track('first'); time = 50; instance.track('second'); time = 150; instance.track('third');
    expect(events.map(e => e.sessionId)).toEqual(['session-1', 'session-1', 'session-2']);
  });
  it('checks DNT again at flush and purges the queued event without sending it', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'doNotTrack');
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' });
    try {
      const { instance, events } = setup({ respectDNT: true, consent: { default: true } }); instance.track('queued');
      Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' }); await instance.flush(); expect(events).toEqual([]);
    } finally { if (previous) Object.defineProperty(navigator, 'doNotTrack', previous); else Reflect.deleteProperty(navigator, 'doNotTrack'); }
  });
  it('supports label alias, submit/change triggers, once and debounced disposal', () => {
    vi.useFakeTimers(); const track = vi.fn();
    const el = document.createElement('form'); el.setAttribute('zen-track', 'purchase'); el.setAttribute('zen-track-on', 'submit'); el.setAttribute('data-label', 'cart'); el.setAttribute('zen-track-once', '');
    const dispose = bindTrack(el, { analytics: { track } }); el.dispatchEvent(new Event('submit')); el.dispatchEvent(new Event('submit'));
    expect(track).toHaveBeenCalledOnce(); expect(track).toHaveBeenCalledWith('purchase', { label: 'cart' }); dispose();
    el.setAttribute('zen-track-on', 'change'); el.setAttribute('zen-track-debounce', '20');
    const delayed = bindTrack(el, { analytics: { track } }); el.dispatchEvent(new Event('change')); delayed(); vi.advanceTimersByTime(20); expect(track).toHaveBeenCalledOnce();
  });
  it('removes router and directive registrations per installed App', () => {
    const unregister = vi.fn(), releaseRoute = vi.fn(), provide = vi.fn();
    const install = analyticsPlugin({ router: { afterEach: () => releaseRoute } });
    const cleanup = install.install({ provide, directive: () => unregister }); cleanup(); cleanup();
    expect(unregister).toHaveBeenCalledOnce(); expect(releaseRoute).toHaveBeenCalledOnce();
    expect(provide).toHaveBeenCalledWith('zenith:analytics', expect.objectContaining({ track: expect.any(Function) }));
  });
  it('keeps provider factories inert; beacon refusal becomes a structured failure', async () => {
    const beacon = vi.fn(() => false); const provider = beaconProvider({ url: '/analytics', sendBeacon: beacon });
    expect(beacon).not.toHaveBeenCalled(); expect(() => provider.send({ type: 'track', name: 'test', timestamp: 0 })).toThrowError(expect.objectContaining({ code: 'ZEN-1901' }));
    const gtag = vi.fn(), plausible = vi.fn(); vi.stubGlobal('gtag', gtag); vi.stubGlobal('plausible', plausible);
    const a = gtagProvider({ id: 'G-test' }), b = plausibleProvider({ domain: 'example.invalid' });
    expect(gtag).not.toHaveBeenCalled(); expect(plausible).not.toHaveBeenCalled();
    await a.send({ type: 'page', name: '/account', timestamp: 0 }); await b.send({ type: 'track', name: 'buy', timestamp: 0 });
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ send_to: 'G-test', page_path: '/account' })); expect(plausible).toHaveBeenCalledOnce();
  });
});
