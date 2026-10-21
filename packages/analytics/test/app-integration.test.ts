// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { analyticsPlugin, type Analytics } from '../src';

const apps: App[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.dispose()); document.body.replaceChildren(); vi.useRealTimers(); });

describe('actual App analytics integration (#155, code-first not run)', () => {
  it('keeps consent and payload context independent between two Apps', async () => {
    const aEvents = vi.fn(), bEvents = vi.fn();
    function setup(send: typeof aEvents, item: string) {
      const app = createApp({ state: { item: signal(item) } }); apps.push(app);
      app.use(analyticsPlugin({ respectDNT: false, sessionIdFactory: () => 'test', batch: { size: 1, interval: 0 }, providers: [{ name: 'test', send }] }));
      const root = document.createElement('main');
      root.innerHTML = '<button zen-track="buy" zen-track-props="{item: item}">Buy</button>';
      document.body.appendChild(root); app.mount(root);
      return { app, button: root.querySelector('button')!, analytics: app.inject<Analytics>('zenith:analytics')! };
    }
    const a = setup(aEvents, 'a'), b = setup(bEvents, 'b');
    a.analytics.setConsent(true); a.button.click(); b.button.click();
    await a.analytics.flush(); await b.analytics.flush();
    expect(aEvents).toHaveBeenCalledWith(expect.objectContaining({ name: 'buy', props: { item: 'a' } }));
    expect(bEvents).not.toHaveBeenCalled();
    a.app.dispose(); b.analytics.setConsent(true); b.button.click();
    await b.analytics.flush(); expect(bEvents).toHaveBeenCalledWith(expect.objectContaining({ props: { item: 'b' } }));
  });

  it('accepts native string-route callbacks and releases the exact subscription', () => {
    const send = vi.fn(), unregister = vi.fn();
    let route!: (path: string, from: string) => void;
    const app = createApp(); apps.push(app);
    app.use(analyticsPlugin({ respectDNT: false, consent: { default: true }, sessionIdFactory: () => 'test', batch: { size: 1, interval: 0 }, providers: [{ name: 'test', send }], router: {
      afterEach(callback: (to: string, from: string) => void) { route = callback; return unregister; },
    } }));
    route('/next', '/before'); expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'page', name: '/next' }));
    app.dispose(); route('/late', '/next'); expect(send).toHaveBeenCalledTimes(1); expect(unregister).toHaveBeenCalledOnce();
  });

  it('disposes bindings on plugin uninstall, including a pending debounce', () => {
    vi.useFakeTimers(); const send = vi.fn(); const app = createApp(); apps.push(app);
    const release = analyticsPlugin({ respectDNT: false, consent: { default: true }, providers: [{ name: 'test', send }] }).install(app);
    const root = document.createElement('main'); root.innerHTML = '<button zen-track="buy" zen-track-debounce="20">Buy</button>';
    document.body.appendChild(root); app.mount(root);
    root.querySelector('button')!.click(); release(); release();
    expect(vi.getTimerCount()).toBe(0); vi.runAllTimers(); expect(send).not.toHaveBeenCalled();
  });

  it('cancels bindings automatically when the DOM is removed before debounce dispatch', async () => {
    vi.useFakeTimers(); const send = vi.fn(); const app = createApp(); apps.push(app);
    app.use(analyticsPlugin({ respectDNT: false, consent: { default: true }, providers: [{ name: 'test', send }] }));
    const root = document.createElement('main'); root.innerHTML = '<button zen-track="buy" zen-track-debounce="20">Buy</button>';
    document.body.appendChild(root); app.mount(root);
    root.querySelector('button')!.click(); root.remove(); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0); vi.runAllTimers(); expect(send).not.toHaveBeenCalled();
  });
});
