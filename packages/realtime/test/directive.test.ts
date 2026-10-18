// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { logger } from '@zenith/logger';
import { bindRealtime, realtimePlugin } from '../src';
import { FakeEventSource, FakeSocket } from './fake-socket';

const owners: App[] = [];
afterEach(() => { owners.splice(0).forEach(app => app.dispose()); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });
function setup(html: string, extra: Parameters<typeof realtimePlugin>[0] = {}) {
  const sockets: FakeSocket[] = [];
  const app = createApp({ state: { endpoint: 'wss://example.invalid/feed' } }); owners.push(app);
  app.use(realtimePlugin({ reconnect: false, webSocketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; }, ...extra }));
  const root = document.createElement('main'); root.innerHTML = html; document.body.appendChild(root);
  app.mount(root); return { app, root, sockets };
}

describe('runtime-core realtime directive integration (#154, not run)', () => {
  it('publishes named signal state without parsing zen-state as JSON', () => {
    const { root, sockets } = setup('<section zen-ws="endpoint" zen-state="feed"><output zen-text="feed.status"></output><b zen-text="feed.messages.length"></b></section>');
    expect(sockets).toHaveLength(1); sockets[0]!.open(); flushSync();
    expect(root.querySelector('output')?.textContent).toBe('open');
    sockets[0]!.message('{"value":42}'); flushSync();
    expect(root.querySelector('b')?.textContent).toBe('1');
  });
  it('filters a named topic and dispatches matching DOM messages only', () => {
    const { root, sockets } = setup('<section zen-ws="endpoint" zen-realtime-topic="news"><output zen-text="data.messages.length"></output></section>');
    const message = vi.fn(); root.addEventListener('zen-realtime-message', message);
    sockets[0]!.open(); sockets[0]!.message('{"topic":"other"}'); flushSync();
    expect(root.querySelector('output')?.textContent).toBe('0'); expect(message).not.toHaveBeenCalled();
    sockets[0]!.message('{"topic":"news","value":42}'); flushSync();
    expect(root.querySelector('output')?.textContent).toBe('1'); expect(message).toHaveBeenCalledOnce();
  });
  it('sends reactive values through the actual transport, then stops on dispose', () => {
    const send = signal('first'); const socket = new FakeSocket();
    const app = createApp({ state: { send } }); owners.push(app);
    app.use(realtimePlugin({ reconnect: false, webSocketFactory: () => socket }));
    const root = document.createElement('div'); root.innerHTML = '<section zen-ws="wss://example.invalid/feed" zen-realtime-send="send"></section>';
    app.mount(root); socket.open(); expect(socket.sent).toEqual(['"first"']);
    send.set('second'); flushSync(); expect(socket.sent).toEqual(['"first"', '"second"']);
    app.dispose(); send.set('late'); flushSync(); expect(socket.sent).toHaveLength(2); send.dispose();
    expect(socket.onmessage).toBeNull();
  });
  it('cancels reconnect timers and removes native handlers after actual DOM removal', async () => {
    vi.useFakeTimers(); vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { root, sockets } = setup('<section zen-ws="endpoint"></section>', { reconnect: { delay: 100, jitter: 0 } });
    sockets[0]!.open(); sockets[0]!.lost(); expect(vi.getTimerCount()).toBe(1);
    root.querySelector('section')!.remove(); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0); expect(sockets[0]!.onmessage).toBeNull();
    vi.advanceTimersByTime(1000); expect(sockets).toHaveLength(1);
  });
  it('uses the native EventSource adapter with named SSE events', () => {
    const source = new FakeEventSource();
    const { root } = setup('<section zen-sse="https://example.invalid/events" zen-realtime-topic="news"><output zen-text="data.messages.length"></output></section>', { eventSourceFactory: () => source });
    source.open(); source.dispatchEvent(new MessageEvent('news', { data: '{"value":42}' })); flushSync();
    expect(root.querySelector('output')?.textContent).toBe('1');
  });
  it('cleans previous bindings on replacement and makes returned cleanup idempotent', () => {
    const first = new FakeSocket(); const second = new FakeSocket(); const el = document.createElement('div');
    const context = { expr: 'wss://example.invalid/feed', attrName: 'zen-ws', context: {}, processChildren() {}, options: { reconnect: false, webSocketFactory: () => first } };
    const old = bindRealtime(el, context);
    const latest = bindRealtime(el, { ...context, options: { ...context.options, webSocketFactory: () => second } });
    expect(first.closes).toBe(1); old(); expect(second.closes).toBe(0);
    latest(); latest(); expect(second.closes).toBe(1);
  });
  it('rejects malformed options and unsafe output names without logging private JSON', () => {
    const el = document.createElement('div'); el.setAttribute('zen-realtime-options', '{"token":"private"');
    const context = { expr: 'wss://example.invalid/feed', attrName: 'zen-ws', context: {}, processChildren() {} };
    try { bindRealtime(el, context); throw new Error('Expected validation error'); }
    catch (error) { expect(error).toMatchObject({ code: 'ZEN-1001' }); expect(JSON.stringify(error)).not.toContain('private'); }
    el.removeAttribute('zen-realtime-options'); el.setAttribute('zen-state', '__proto__');
    expect(() => bindRealtime(el, context)).toThrow(/ZEN-1001/);
  });
  it('keeps identically named states and transports independent between Apps', () => {
    const a = setup('<section zen-ws="endpoint"><output zen-text="data.status"></output></section>');
    const b = setup('<section zen-ws="endpoint"><output zen-text="data.status"></output></section>');
    a.sockets[0]!.open(); b.sockets[0]!.open(); flushSync(); a.app.dispose();
    expect(a.sockets[0]!.closes).toBe(1); expect(b.sockets[0]!.closes).toBe(0);
    b.sockets[0]!.message('42'); flushSync(); expect(b.root.querySelector('output')?.textContent).toBe('open');
  });
});
