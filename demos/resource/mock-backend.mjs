import { createMockServer, rest, respond } from '@zenith/mock';

/** The demo uses the same REST engine as testing.mockHttp and browser fixtures. */
export function installResourceBackend({ latency = 400 } = {}) {
  const initial = [
    { id: 1, name: 'محصول ۱', price: 1000 },
    { id: 2, name: 'محصول ۲', price: 2000 },
    { id: 3, name: 'محصول ۳', price: 3000 },
  ];
  let items = initial.map(item => ({ ...item })), nextId = 4;
  const server = createMockServer([
    rest.get('/api/items', () => respond({ json: items })),
    rest.get('/api/items/:id', ({ params }) => {
      const item = items.find(value => String(value.id) === params.id);
      return respond({ status: item ? 200 : 404, json: item ?? { message: 'Not found' } });
    }),
    rest.post('/api/items', async ({ request, signal }) => {
      const body = await request.json(); if (signal.aborted) throw signal.reason;
      const item = { name: body.name, price: body.price, id: nextId++ };
      items.push(item); return respond({ status: 201, json: item });
    }),
    rest.put('/api/items/:id', async ({ request, params, signal }) => {
      const item = items.find(value => String(value.id) === params.id);
      if (!item) return respond({ status: 404, json: { message: 'Not found' } });
      const body = await request.json(); if (signal.aborted) throw signal.reason; Object.assign(item, { name: body.name ?? item.name, price: body.price ?? item.price }); return respond({ json: item });
    }),
    rest.delete('/api/items/:id', ({ params }) => {
      const index = items.findIndex(value => String(value.id) === params.id);
      if (index < 0) return respond({ status: 404, json: { message: 'Not found' } });
      items.splice(index, 1); return respond({ json: { success: true } });
    }),
  ], { baseURL: globalThis.location?.origin ?? 'http://localhost', latency, onUnhandledRequest: 'bypass', record: true });
  server.listen();
  return {
    server,
    reset() { server.reset(); items = initial.map(item => ({ ...item })); nextId = 4; },
    dispose() { server.dispose(); },
  };
}
