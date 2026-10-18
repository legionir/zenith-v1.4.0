# @zenith/adapter-edge

Fetch SSR for Cloudflare module Workers and Deno, with an explicit, fresh DOM
per request. The implementation imports `@zenith/ssr/edge`, **not** the Node SSR
barrel, `jsdom`, `AsyncLocalStorage`, `node:crypto`, `fs` or Node streams.

```ts
import { createCloudflareHandler } from '@zenith/adapter-edge';

export default createCloudflareHandler({
  template: '<main id="app"><h1 zen-text="title"></h1></main>',
  state: async (_route, { request, env, signal }) => ({ title: 'Welcome' }),
  head: { title: 'Welcome' },
  csp: { nonce: true },
  timeout: 5000,
});
```

Install the optional `linkedom` peer for the default DOM. It is external to the
thin adapter artifact; the deployment bundler must bundle it. DOM libraries and
the full application count toward the separate 1 MB deployment budget.
`ZEN-1812` reports a missing DOM. `ZEN-1811` reports an unsupported Fetch host or
configuration. `happy-dom` is supported **only through an explicit `createDOM`
factory on a compatible host**: it is not silently imported into Workers because
its Node dependencies violate the default Worker target. A factory returns
`{ document, dispose? }`; never share it across live requests. Reuse is rejected.

`createFetchHandler(options)` returns `(request, env?, ctx?) => Promise<Response>`.
`createCloudflareHandler` returns `{ fetch }`; `createDenoHandler` returns a
`Deno.serve`-compatible function. GET/HEAD are supported; other methods receive
405/Allow. The default health endpoint is `/health` (`health: false` disables it).
`assets(path, context)` returns a Response or `undefined` for a clean miss;
malformed and traversal paths are rejected before this callback is called.

State is copied per request, including plain nested objects, collections and
canonical Readables (fresh, owned signals). Accessors and unsupported class
instances are rejected rather than shared or invoked implicitly. Put trusted
actions/plugins in the App factory; function closures remain application-owned.

State/head/i18n loaders receive an explicit `{ request, url, env,
executionContext, signal }`; they run before mounting. Loaders must honor their
signal to stop their own external work. Late results cannot mount or publish.
Timeouts return 504, client cancellation 499; exceptions return a generic 500,
never user state or raw exception messages. Responses default to `no-store`.
CSP nonces use host Web Crypto and apply to JSON-LD and the hydration script.

An `app(context)` factory may return a fresh `createApp` instance, with plugins.
It runs in a request-owned registry scope; the App is always disposed on success
or failure. Inside the factory/mount, use `context.document`, `context.head` and
`context.state`, not ambient DOM globals. Synchronous App work cannot be
interleaved by another request. No global window/document swapping is performed.
Do not return an async factory or a borrowed singleton App. Async custom plugin
work must explicitly retain its request context, honor cancellation and avoid
mutating disposed Apps. Automatic Node-only legacy `Zen.process` adapters are not
part of this entry; use runtime-core Apps/plugins. `i18n` supplies request-owned
locale/dir/messages for head/hydration; translation plugins are installed by the
App factory rather than process-wide locale mutation.

`waitUntil` defaults to true when an execution context is supplied. Optional
`onResponse(responseClone, context)` and asynchronous DOM disposal are owned
background tasks registered there; failures use safe diagnostics. Without it,
these tasks are awaited within the request deadline. Custom DOM disposal must
release its own timers/listeners and must never mutate another request's DOM.

## Validation status

Unit, 100-request isolation, Worker-bundle/Miniflare and Deno fixtures are source
contracts, not evidence of a passing deployment. No tests/builds have been run
for the code-first remediation. The 6 KB adapter / 1 MB deployment limits and
real Worker/Deno behavior remain pending final validation.

Final-validation commands (not run): `npx vitest run packages/adapter-edge/test`
and `node scripts/repro/edge-deno.mjs` (requires Deno; absence fails rather than
skipping). Miniflare uses Node >=22 only as a development harness, not in the
published Worker adapter. The harness bundles workspace sources and the DOM,
checks the 1 MB uncompressed deployment limit, and asserts no jsdom/Node inputs.

Hydration state follows JSON semantics. Use JSON-compatible application data for
round trips; copying Map/Set/Date/RegExp protects request ownership but does not
promise an automatic tagged client-side codec for those types.
