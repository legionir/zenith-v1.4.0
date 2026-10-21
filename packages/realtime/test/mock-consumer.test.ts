import { afterEach, expect, it, vi } from 'vitest';
import { createMockServer, ws } from '@zenith/mock';
import { createRealtime, type Realtime } from '../src';
const owners: Array<{ dispose(): void }> = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.dispose()); });
it('uses the public mock WebSocket engine without the test-injection receiver', async () => {
  const original = globalThis.WebSocket, link = ws.link('ws://localhost/events'), frames: unknown[] = [];
  link.on('connection', ({ client }) => { client.addEventListener('message', event => { frames.push(JSON.parse(String(event.data))); client.send('{"topic":"news","value":42}'); }); });
  const server = createMockServer([link]); owners.push(server); server.listen();
  const realtime = createRealtime({ url: 'ws://localhost/events', autoConnect: false, reconnect: false, auth: async () => 'private-token' }); owners.push(realtime); realtime.send({ topic: 'subscribe' }); realtime.open();
  await vi.waitFor(() => expect(realtime.lastMessage.get()).toEqual({ topic: 'news', value: 42 })); expect(frames).toEqual([{ type: 'auth', token: 'private-token' }, { topic: 'subscribe' }]); realtime.dispose(); server.close(); expect(globalThis.WebSocket).toBe(original);
});
it('server reset closes connected public Realtime consumers and their cleanup cancels retries', async () => {
  const server = createMockServer([ws.link('ws://localhost/events')]); owners.push(server); server.listen();
  const realtime: Realtime = createRealtime({ url: 'ws://localhost/events', autoConnect: false, reconnect: false }); owners.push(realtime); realtime.open(); await vi.waitFor(() => expect(realtime.status.get()).toBe('open')); server.reset(); await vi.waitFor(() => expect(realtime.status.get()).toBe('closed')); realtime.dispose();
});
