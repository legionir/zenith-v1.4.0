import { afterEach, expect, it, vi } from 'vitest';
import { createMockServer, passthrough, respond, rest, type MockServer } from '../src';
const owners: MockServer[] = [];
function own(server: MockServer) { owners.push(server); return server; }
afterEach(() => { owners.splice(0).forEach(server => server.close()); });
it('rejects dispatch on a closed owner and permits a new explicit listening lease', async () => {
  const server = own(createMockServer([rest.get('/a', () => respond({ text: 'ok' }))])); server.close(); await expect(server.handle(new Request('http://localhost/a'))).rejects.toMatchObject({ name: 'AbortError' }); server.listen(); expect(await (await server.handle(new Request('http://localhost/a'))).text()).toBe('ok');
});
it('preserves a POST body after a resolver reads it and chooses passthrough', async () => {
  const input = { secret: 'body-only' }, seen: unknown[] = []; const server = own(createMockServer([rest.post('/a', async ({ request }) => { seen.push(await request.json()); return passthrough(); })], { record: true }));
  const fallback = vi.fn<typeof fetch>(async request => { seen.push(await (request as Request).json()); return respond({ status: 201 }); });
  expect((await server.handle(new Request('http://localhost/a', { method: 'POST', body: JSON.stringify(input) }), fallback)).status).toBe(201); expect(seen).toEqual([input, input]); expect(JSON.stringify(server.calls)).not.toContain('body-only');
});
it('closing the server aborts in-progress passthrough and observes its late rejection', async () => {
  let signal: AbortSignal | undefined, reject!: (error: Error) => void, started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  const server = own(createMockServer([], { onUnhandledRequest: 'bypass' })), fallback = vi.fn<typeof fetch>(request => { signal = (request as Request).signal; started(); return new Promise((_resolve, fail) => { reject = fail; }); });
  const pending = server.handle(new Request('http://localhost/a'), fallback), rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); await ready; server.close(); await rejected; expect(signal?.aborted).toBe(true); reject(new Error('late original fetch rejection')); await Promise.resolve();
});
it('reset aborts old resolver work without letting it repopulate call records', async () => {
  let complete!: (value: Response) => void; const server = own(createMockServer([rest.get('/a', () => new Promise<Response>(resolve => { complete = resolve; }))], { record: true })); const pending = server.handle(new Request('http://localhost/a')), rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); server.reset(); await rejected; complete(respond()); await Promise.resolve(); expect(server.calls).toEqual([]);
});

it('never invokes an already-aborted resolver after a latency continuation', async () => {
  const { resolveRequest } = await import('../src/http'); const controller = new AbortController(), resolver = vi.fn(() => respond()); controller.abort(); await expect(resolveRequest(rest.get('/a', resolver), new Request('http://localhost/a'), {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' }); expect(resolver).not.toHaveBeenCalled();
});
