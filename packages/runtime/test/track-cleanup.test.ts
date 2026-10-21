// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { configureAnalytics, processTrack } from '../src/directives/track';
import { logger } from '@zenith/logger';
import { resetDefaultAppForTesting } from '@zenith/runtime-core';
afterEach(() => { configureAnalytics(null); resetDefaultAppForTesting(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('cancels deferred legacy click tracking when disposed before the next task', () => {
  vi.useFakeTimers(); const track = vi.fn(); configureAnalytics(track, { consent: true });
  const el = document.createElement('button'); const cleanup = processTrack(el, 'click:buy', {});
  el.click(); cleanup(); cleanup(); vi.runAllTimers(); expect(track).not.toHaveBeenCalled();
});
it('contains async legacy handler failures without leaking the raw exception', async () => {
  vi.useFakeTimers(); const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  configureAnalytics(async () => { throw new Error('Bearer private-token'); }, { consent: true });
  const el = document.createElement('button'); const cleanup = processTrack(el, 'buy', {});
  el.click(); await vi.runAllTimersAsync(); cleanup();
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'ZEN-1901' }));
  expect(JSON.stringify(error.mock.calls)).not.toContain('private-token');
});

it('default App disposal cancels old timers/listeners and cannot deliver into a new handler', () => {
  vi.useFakeTimers(); const first = vi.fn(); const second = vi.fn();
  configureAnalytics(first, { consent: true });
  const el = document.createElement('button'); processTrack(el, 'buy', {});
  el.click(); expect(vi.getTimerCount()).toBe(1);
  resetDefaultAppForTesting(); expect(vi.getTimerCount()).toBe(0);
  configureAnalytics(second, { consent: true }); el.click(); vi.runAllTimers();
  expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
});

it('requires explicit consent before a legacy handler can receive DOM events', async () => {
  vi.useFakeTimers(); const track = vi.fn(); configureAnalytics(track);
  const el = document.createElement('button'); const cleanup = processTrack(el, 'buy', {});
  el.click(); await vi.runAllTimersAsync(); expect(track).not.toHaveBeenCalled();
  const { setAnalyticsConsent } = await import('../src/directives/track'); setAnalyticsConsent(true);
  el.click(); await vi.runAllTimersAsync(); expect(track).toHaveBeenCalledExactlyOnceWith('buy', el); cleanup();
});
it('withdrawal permanently cancels an already scheduled callback, even if consent is regranted', async () => {
  vi.useFakeTimers(); const track = vi.fn(); configureAnalytics(track, { consent: true });
  const { setAnalyticsConsent } = await import('../src/directives/track');
  const el = document.createElement('button'); const cleanup = processTrack(el, 'buy', {});
  el.click(); setAnalyticsConsent(false); setAnalyticsConsent(true); await vi.runAllTimersAsync(); expect(track).not.toHaveBeenCalled();
  el.click(); await vi.runAllTimersAsync(); expect(track).toHaveBeenCalledOnce(); cleanup();
});
it('honors live DNT in the legacy callback adapter as well as the canonical engine', async () => {
  vi.useFakeTimers(); const track = vi.fn(); configureAnalytics(track, { consent: true });
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'doNotTrack');
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
  const el = document.createElement('button'); const cleanup = processTrack(el, 'buy', {});
  try { el.click(); await vi.runAllTimersAsync(); expect(track).not.toHaveBeenCalled(); }
  finally { cleanup(); if (descriptor) Object.defineProperty(navigator, 'doNotTrack', descriptor); else Reflect.deleteProperty(navigator, 'doNotTrack'); }
});
it('lets a once binding finish exactly one deferred canonical delivery before disposing it', async () => {
  vi.useFakeTimers(); const track = vi.fn(); configureAnalytics(track, { consent: true });
  const el = document.createElement('button'); el.setAttribute('zen-track-once', ''); const cleanup = processTrack(el, 'buy', {});
  el.click(); el.click(); await vi.runAllTimersAsync(); expect(track).toHaveBeenCalledExactlyOnceWith('buy', el); cleanup();
});
it('does not transfer queued events into a replacement legacy handler', async () => {
  vi.useFakeTimers(); const first = vi.fn(), second = vi.fn(); configureAnalytics(first, { consent: true });
  const el = document.createElement('button'); const cleanup = processTrack(el, 'buy', {});
  el.click(); configureAnalytics(second, { consent: true }); await vi.runAllTimersAsync(); expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
  el.click(); await vi.runAllTimersAsync(); expect(second).toHaveBeenCalledOnce(); cleanup();
});
