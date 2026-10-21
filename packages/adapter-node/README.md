# @zenith/adapter-node

Node-only adapter using the shared `@zenith/ssr` renderer and native
`node:async_hooks` (including Node 18, which lacks `process.getBuiltinModule`).
The separate `@zenith/ssr/edge` entry does not import this Node path.

```ts
import { createApp } from '@zenith/runtime';
import { createNodeServer } from '@zenith/adapter-node';
const server = createNodeServer({
  template: '<!doctype html><html><head><title>Example</title></head><body><main id="app"><!--zen-outlet--><h1 zen-text="title"></h1></main><script type="module" src="/entry.js"></script></body></html>',
  app: () => createApp(),
  state: () => ({ title: 'Welcome' }),
  staticDir: './public', staticOptions: { maxAge: 3600 },
  port: 3000, host: '0.0.0.0', gracefulShutdownTimeout: 10000,
});
await server.listen();
await server.close();
```

## Request ownership and templates

`app(context)` is required and may be async; return a **fresh** App for every
request. The renderer disposes it even when mount/serialization fails. A late
factory result after abort/timeout is disposed without mounting; its DOM is never
lent to another request. Reusing a factory App is rejected. For legacy borrowed
Apps and unmarked fragments, the existing `@zenith/ssr` facade remains separate.

`template` accepts a trusted HTML string or async `(context) => string` loader.
Exactly one actual `<!--zen-outlet-->` comment must occur in the body (not inside
script text). Its containing element is mounted, preferring `#app` when present;
a marker directly in body gets an empty `div#app` mount container. Put the binding
markup inside the mount container. Static head, body siblings, module scripts and
root attributes are retained. Request head tags replace matching static title,
base, meta and link entries while preserving unrelated tags.

`state(url, context)`, `head(url, context)` and `i18n(url, context)` may be async.
The first argument preserves the compatibility pathname-plus-query string.
Context includes `{req,res,url,ip,requestId,signal,nonce,onDispose}`; the App factory
also gets `{document,state,head,route}`. Register loader acquisitions with
`context.onDispose(cleanup)`. Registries acquired by loaders are request-scoped
across awaits. Context documents/head managers are borrowed for rendering only.

State is snapshotted by the same helper as the Edge adapter. Source signals are
borrowed, copied signals are request-owned, and nested aliases/cycles are copied
without mutating the source. Cycles/opaque values still need a serialization
strategy: snapshot support does not promise JSON round-tripping for Map/Set or
cycles. Functions remain borrowed references; factories/closures must not capture
shared mutable request data. Accessor properties are rejected, not executed.

## Streaming, headers and cancellation

- `stream:true` (default) uses the shared `renderToStream` and `stream.pipeline`
  backpressure. SSR collects DOM/head/state, then serializes HTML on demand without
  a full rendered-root string. It retains the owned App/DOM until consumption or
  cancellation; this is **not** progressive async-component or constant-memory DOM
  rendering. `stream:false` sends one completed document. Functional cache-control
  hooks still require a complete result and intentionally use buffered compatibility.
  HEAD/406/disconnect paths await child SSR cleanup before parent loader disposal.
- HTML and static assets negotiate Brotli/gzip/identity, preserve `Vary`, return
  406 when no enabled representation is acceptable, and support HEAD.
- `cacheControl` accepts a string or `(req, result) => string`, called once after
  rendering and before committing headers. Default HTML policy is `no-store`.
  Never cache personalized HTML publicly without a suitable identity/cache key.
- Nonces default on and are shared by hydration, managed JSON-LD and trusted
  template scripts/styles. A custom CSP string can contain `{{nonce}}`.
  CSP/HMR browser compatibility is still a final integration gate; development
  websocket policies may need explicit configuration.
- `timeout` defaults to 10000 ms and covers loaders, rendering and delivery. Zero
  schedules an immediate deadline; values must be finite and in 0..2147483647.
  Before commitment a deadline produces 503; after commitment the stream closes.
  A client disconnect aborts the signal and notifies `onAbort` at most once.
  User async work must respect the signal; arbitrary promises cannot be forcibly
  stopped. The renderer still disposes a late returned App.
- `onError(error,req,res)` may complete a custom response. Otherwise errors are
  redacted, non-cacheable 500/503 responses; committed responses are destroyed.
  Request logs contain requestId/status/timing, not URLs, bodies or credentials.
- `trustProxy:false` ignores forwarded headers. Set true **only** behind a trusted
  proxy that replaces incoming X-Forwarded-Proto/Host/For headers: true trusts
  every upstream connection. Context origin/IP then use their first values.
  Malformed trusted metadata is rejected. No global request object is mutated.

`nodeHandlerOptions` exposes the schema/defaults/resolver; malformed transport
options fail in production too. Health defaults to `/healthz`, bypasses loaders,
and can be disabled with false. Route misses call middleware `next` when supplied,
otherwise return 404. Health is handled before route filtering.

## Static middleware and servers

`serveStatic(directory, options)` rejects traversal, dotfiles, malformed encoding
and symlink escapes, uses native backpressure, weak ETag/conditional GET (or
`etag:false`), Last-Modified, MIME/nosniff and cache headers. `maxAge` is seconds.
Serve a dedicated public directory, never a repository root. Compatibility
bridges `serveStatic({root,...})` and handler `static:{root,...}` remain available;
prefer `staticDir`/`staticOptions`.

Servers expose `{server,handler,listen,close,dispose}`. `listen(port,host?)` returns
void; configured `listen()` returns `{port,host}`. `dispose()` initiates shutdown;
await `close()` for drainage. `gracefulShutdownTimeout` replaces the deprecated
`shutdownTimeout`; concurrent close/listen waits for the listener and the final
deadline destroys tracked sockets, including upgraded sockets. No process signal
listeners are installed implicitly. Slow-client budget (#156): `headersTimeout`
(default 10000) caps header receipt and `requestTimeout` (default 30000, 0
disables per Node semantics) caps the whole request; both are applied to the
underlying `http.Server` and validated like the other timeouts. Render-phase
hangs stay under the handler `timeout` (503) — socket budgets and render
deadline are orthogonal.

## Framework middleware (Express/Fastify)

`toExpressMiddleware`/`createExpressMiddleware` and
`toFastifyHandler`/`createFastifyHandler` expose the same canonical handler —
same template outlet, loaders, timeout/abort ownership, compression, CSP nonce,
error redaction and backpressure — to framework routers. Neither framework is a
dependency; request/response objects are used structurally (`IncomingMessage` /
`ServerResponse`, or Fastify `{ raw }` shells), so no framework version is
imported or required.

```ts
import express from 'express';
import { createExpressMiddleware } from '@zenith/adapter-node';
const app = express();
app.use(createExpressMiddleware({ template, app: () => createApp() }));
```

```ts
import Fastify from 'fastify';
import { createFastifyHandler } from '@zenith/adapter-node';
const server = Fastify();
server.get('/*', createFastifyHandler({ template, app: () => createApp() }));
```

Semantics: a route miss calls Express `next()` untouched, or Fastify
`reply.callNotFound()` when available (`reply.hijack()` is used when present so
the shared transport owns the raw stream). Unexpected wrapper rejections go to
Express `next(error)` or `reply.send(error)` before headers are committed; all
rendered failures keep the shared redacted 500/503 contract.

**Validation status:** source and regression fixtures are candidates, not accepted
card evidence. No tests/build/typecheck/CI have run on these changes. Real framework
middleware consumers, browser hydration/HMR/CSP, full platform/100-request execution,
package/API/budget gates and remaining Node/Edge option parity are still pending.
