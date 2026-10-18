# @zenith/mock

Universal, owner-scoped REST/WebSocket mocking. No patch, listener or timer at import.
The testing package's legacy `mockFetch/mockHttp` facade uses this engine.

```ts
import { createMockServer, rest, respond, ws } from '@zenith/mock';
const socket = ws.link('ws://localhost/events');
socket.on('connection', ({ client }) => client.send('ready'));
const server = createMockServer([
  rest.get('/users/:id', ({ params }) => respond({ json: { id: params.id } })),
  socket,
], { onUnhandledRequest: 'error', record: true });
server.listen();
// tests
server.close();
```

`use()` prepends overrides; `reset()` restores initial handlers, clears records and
closes mock sockets. `close/dispose` restore original globals even when nested owners
close out of order, and preserve unrelated patches installed by other code.
`installFetchMock(server, options?)` supports explicit target ownership. Use
`server.handle(request, originalFetch)` without global patching when possible.

Unhandled requests default to `ZEN-2530`; warn/bypass delegate to the captured original
fetch. `passthrough()` is explicit. `context.respond()` enforces one response per request
(`ZEN-2531`); returning a different response after calling it is also rejected.
Latency accepts a fixed value/range with injected random/clock. Abort cancels delay and
non-cooperative pending resolver waits. Recording is opt-in and bounded (1000 by default),
with method, matched handler pattern and status only: never headers, query, params or bodies.
Legacy testing call recording intentionally preserves its existing explicit test API.

For browser interception copy `dist/worker.js` to a same-origin public URL and call
`setupWorker(server, {url:'/zenith-mock-sw.js'})`. This registers an actual module Service
Worker, relays requests over MessagePorts, and bypasses via worker-native fetch; returned
cleanup detaches this client, not other clients' registration. Do not deploy the mock
worker in production. Service Workers do not intercept WS; the same owner installs the
WebSocket test transport in the page.

Unit/integration/worker implementation is written; real browser SW, HTTP/resource,
pack/target and all final acceptance gates have not yet been executed.

## Lifecycle and browser leases (candidate continuation)

`DEFAULTS`, `mockOptionsSchema` and `mockOptions` expose the runtime-validated
configuration. Defaults are error-on-unhandled, `http://localhost`, zero latency,
recording disabled and at most 1000 call records. Latency/ranges are milliseconds
bounded by native timeout capacity; callbacks/clocks are validated without calling
or freezing them. Invalid configuration fails before transport installation.

Worker protocol v2 gives every installation its own session and routes each
client's requests to its most recent active session. Closing an older server does
not stop a newer one; closing the newest reveals any remaining older session.
Cleanup cancels in-flight ports and pending setup as well as page socket leases;
it never unregisters a registration belonging to other clients. Setup waits for
its own registration's activation, not an unrelated `container.ready` worker.
`activationTimeout` defaults to 5000 ms per wait, and `signal` cancels setup and the
resulting lease. Page hide releases that page's lease. Copy the matching worker
bundle together with the client; older protocol handshakes fail explicitly.

`close()` rejects new dispatch/handle calls until a fresh `listen()` lease reopens
the server. `reset()` aborts the prior generation before clearing calls and handlers.
`handle()` preserves POST bodies inspected by a passthrough resolver, forwards an
abortable request, and observes late fallback rejections after close/reset. Socket
patterns support ws/wss origins; callback registrations have independent leases,
and warn mode never puts the URL into the warning message.

The existing `demos/resource` CRUD backend now consumes this public engine rather
than replacing `window.fetch` with response-shaped objects. Its teardown disposes
the Resource and backend; browser fixtures also import this same demo backend.
New worker-lifecycle, descriptor-restoration, HTTP/body, socket and public Realtime
consumer fixtures are authored **but unexecuted**. Protocol, stricter validation,
API/pack, actual browser behavior and release acceptance remain final gates.
