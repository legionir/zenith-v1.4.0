# @zenith/ssr

Server-Side Rendering and hydration utilities for Zenith.

## Installation

```bash
npm install @zenith/ssr
```

## Usage

### Server-Side Rendering

```typescript
import { renderToString, renderToStream, serializeState, injectState } from '@zenith/ssr';

// Render to string
const html = renderToString(() => `<div id="app">Hello</div>`);

// Inject state for hydration
const appState = { user: { name: 'Ali' } };
const finalHtml = injectState(html, serializeState(appState));

// Render to stream (better TTFB)
const stream = renderToStream(() => renderApp(), { state: appState });
stream.pipe(response);
```

### Server Components

```typescript
import { registerServerComponent, renderServerComponent } from '@zenith/ssr';

registerServerComponent({
  id: 'UserProfile',
  streamable: true,
  render: ({ userId }) => {
    const user = db.getUser(userId);
    return `<div class="profile">${user.name}</div>`;
  },
});

const html = `
  <body>
    ${renderServerComponent('UserProfile', { userId: 123 })}
  </body>
`;
```

### Client Hydration

```typescript
// Canonical public hydrate (#56): `@zenith/runtime-core` — also re-exported
// from `@zenith/runtime` and `zenith/browser`.
import { hydrate } from '@zenith/runtime-core';

await hydrate(document.getElementById('app')!, {
  // state / plugins / ssr validators (AppOptions), or a plain state record
});
```

> Legacy: `hydrate(root, initFn?)` from `@zenith/ssr` is a deprecated
> compatibility bridge (warns once with **ZEN-DEPR-108**, removal in 2.0).
> New code must use the canonical form above.

### Isomorphic Utilities

```typescript
import { isServer, isClient, runOnServer, runOnClient } from '@zenith/ssr';

if (isServer()) {
  // Database access, file reading, server-only tokens
}

if (isClient()) {
  // DOM access, localStorage, user events
}

runOnServer(() => {
  console.log('Running on server');
});

runOnClient(() => {
  console.log('Running in browser');
});
```

## API Reference

- `renderToString(renderFn)` — Render app to HTML string
- `renderToStream(renderFn, options?)` — Render app to stream
- `serializeState(state)` — Serialize state for transfer
- `deserializeState(serialized)` — Deserialize state
- `injectState(html, state)` — Inject state script into HTML
- `loadPreloadedState()` — Load server state on client
- `hydrate(root, init?)` — Hydrate server-rendered HTML (canonical: `@zenith/runtime-core`; legacy `@zenith/ssr` bridge deprecated, ZEN-DEPR-108)
- `registerServerComponent(def)` — Register server component
- `renderServerComponent(id, props?)` — Render server component
- `isServer()` / `isClient()` — Environment checks
- `runOnServer(fn)` / `runOnClient(fn)` — Conditional execution

## Adapter nonce and cancellation hotfix (#156 / #157)

`createNodeHandler` and `createFetchHandler` with `csp: { nonce: true }` now use a
fresh 128-bit cryptographic nonce per response. The generated hydration script
and default CSP header use the same nonce. To supply a custom CSP, include
`{{nonce}}` wherever the generated value belongs:

```ts
const csp = {
  nonce: true,
  policy: "default-src 'self'; script-src 'self' 'nonce-{{nonce}}'",
};
```

A custom policy is otherwise authoritative; a policy that forbids the inline
hydration script will still block it. Do not cache/reuse the generated full HTML
without regenerating its nonce and matching CSP header.

`renderToString(..., { signal })` rejects with `AbortError` on cancellation.
The Node adapter observes request `aborted` and unfinished response `close`,
not normal IncomingMessage `close`, removes its listeners in `finally`, and
does not write an aborted response. The Fetch adapter forwards `request.signal`
and propagates cancellation as `AbortError`, not an HTTP 500 page.
Cancellation stops waiting for async state/component prepass and prevents
subsequent DOM/App allocation. It **cannot forcibly terminate** arbitrary async
work already started by user functions; those must manage their own I/O abort.

These handlers still live in the **Node-targeted `@zenith/ssr` package** (including
Node crypto/AsyncLocalStorage and the default jsdom path). A Fetch-shaped API is
not evidence of a deployable Cloudflare/Deno Edge adapter. Use the separate `@zenith/adapter-edge` and explicit-document `@zenith/ssr/edge`
entry for Edge. Their Worker/Deno fixtures are written but have not been run;
real deployment, remaining #156/#157 parity and final budgets are not certified.


### Request registry ownership (code-first, not validated)

Pass shared server component definitions explicitly through
`RenderOptions.serverComponents`. A request or App no longer fills missing names
from the process-global component/server-component registry. Standalone helpers
outside an owner retain their legacy fallback scope. Created resources/stores in a
request are torn down when it ends, including timeout/error paths; registration
cleanup captures the original registry rather than consulting the ambient owner.
`App.run` supplies an explicit synchronous App boundary. Browser code must re-enter
it after `await`; it is not an asynchronous context shim. The new Edge entry
awaits data before entering synchronous, explicit-document App scopes; it does
not use the legacy async-context fallback. Legacy fallback-context concurrency
and all final browser/SSR gates remain pending.

The jsdom peer is optional for the explicit-document Edge subpath. Consumers of
the Node root must still install `jsdom` (unless supplying their own createDOM).
`@zenith/adapter-node` declares the required jsdom peer for its default path.

### Async App factory ownership (candidate; not yet validated)

The Node renderer accepts `app: async ({document,state,head,route,signal}) => App`.
A returned factory App belongs exclusively to that render, including mount failures
and late resolution after abort/timeout; late Apps are disposed without mounting.
A factory must never return the same App twice. Direct caller-borrowed `app: App`
remains supported, but concurrent use of one borrowed App is rejected. Native
`node:async_hooks` is used on every supported Node version; no shared async stack
fallback is used. Worker callers must use the explicit-document `./edge` entry.

Timeout/abort covers async module setup and factory resolution. Cleanup runs with
the request DOM context; documents retained by pending user factories are closed,
not returned to the template pool. User factories must respect the supplied signal:
SSR cannot forcibly cancel arbitrary external promises or release an App the
factory never returns.

`StreamOptions.shell` lets trusted adapters frame the rendered root without losing
their static template. `onRendered(result)` runs once before the first shell byte
when supplied. Stream chunk boundaries never split a UTF-16 surrogate pair, so
independent UTF-8 encoding preserves non-BMP characters. The collected-head path
still waits for the complete App/prepass DOM; it is not progressive async-component
rendering. Body serialization is now demand-driven rather than a complete HTML
string followed by slicing (see below). `cloneRequestState(input,{cleanup})`, also exported by
`./edge`, snapshots plain data/readables and owns only its copied signals; snapshots
are not a universal cyclic/Map/Set JSON transport codec.


### Owned DOM streaming (code-first candidate; not validated)

The string and stream APIs now share one render lifetime. By default streaming
serializes the mounted HTML DOM into 16K-character chunks (or `chunkSize`) as the
consumer pulls; it does not call the complete rendered root's `outerHTML`. The App,
request registries and DOM remain owned until body consumption finishes, early
iterator return, cancellation, timeout or callback failure. Cleanup completes before
the final `done:true` document chunk. Slow consumers retain a DOM, not a prebuilt
rendered HTML string; this is **not constant-memory DOM rendering** and does not
stream unresolved server components. A stream deadline also covers its retained
lifetime. Callers must not mutate the request DOM while it is being consumed.

`onReady(metadata)` receives state/route/head/attribute/i18n metadata without an HTML
field. A shell with `metadataOnly:true` accepts the same metadata-only contract and
opts out of full-result buffering. Existing `onRendered(result)` and shells without
that flag retain their full `result.html` contract and therefore deliberately buffer.
The Node adapter uses metadata-only framing unless a functional cache-control hook
needs the full rendered result.

The HTML walker handles namespace attributes, template content, void elements,
comments and raw text without global DOM constructors or recursive traversal. UTF-16
pairs remain intact even across adjacent Text nodes. Native `noscript` serialization
is retained for implementation-dependent scripting flags; custom XML documents use
their native serialization as a compatibility fallback. Those fallback subtrees,
state JSON and the opening shell are not promised bounded temporary strings.

All Node render paths snapshot request state without taking ownership of caller
signals. The early legacy shell and its later body use one input snapshot. Cached
parser templates are inert: every user-visible request gets a fresh Window/Document,
so head, storage, event listeners or custom globals cannot leak through window reuse.
The legacy `pooledDOMInstances` statistic now counts idle **parser template owners**,
not reusable user-visible request Windows. Diagnostics are bounded; `cacheTemplates:
false` does not retain input HTML diagnostic keys, and clearing the cache prevents
already-active renders from refilling the old cache generation.

Fixtures cover native serialization parity, bounded demand, cancellation/cleanup,
legacy callback compatibility, fresh windows, shared-signal isolation, 100 overlapping
Apps and Node transport/HEAD nesting. They have been authored, **not executed**.

## Request reactivity ownership (unvalidated implementation candidate)

The Node renderer consumes State host hooks from `@zenith/state/internal` while
application state APIs remain on the public State root. Every render, including
one with no `route` option, enters a native route scope (default `/`) and a native
DOM scope. Failure to load route isolation is no longer silently treated as a
successful shared-browser fallback.

A request-owned State root covers server-component prepass and async App factories,
not only mounted directives. Its owner is stored in the request's EffectContext
across awaits. Native snapshots are captured per callback registration, preserving
all active native ALS stores when the shared scheduler dispatches another request's
work or a late disposer runs. Abort dispatch is also bound to the request scope.
The Node DOM store and App claim sets are shared across the ESM/CJS render conditions;
request data and owners remain separate. This is not a shared mutable request object.

Cleanup stops ambient request reactivity before releasing App/registry/state/DOM
resources on completion, error, timeout, abort and stream cancellation. A retired
request retains a **disposed owner tombstone** so a late async continuation cannot
create fresh default-owned effects. This does not cancel arbitrary user promises,
undo their side effects, revoke raw Signal objects, or forbid an explicit detached
owner/root escape. Caller-owned detached resources remain the caller's responsibility.

Real 100-render, prepass/factory, paused stream, cancellation/late continuation,
100-live-scope scheduler and built ESM/CJS consumer fixtures are written, **not run**.
No claim of passing concurrency, consumer, type, size or release gates is made.

### Diagnostic lifetime and construction order (candidate)

The native DOM context, State host-disposal registration and global-observation
policy are installed **before** the route scope constructs its Signal. Otherwise
even a request-isolated route holder could leak route records into the fallback
State registry. Default priorities and legacy inspection views are request-local;
ordinary outside module inspection cannot enumerate another request's records.
Shared signals update only the live views that registered their actual identity.
After reactive teardown, the diagnostic registry is explicitly retired before App/
DOM release, including for paused/cancelled streams and late continuations.

Realm-global observer/Devtools capture is disabled for route/prepass/factory state;
manual Devtools registration obeys the same host policy. The old compatibility
registry remains locally inspectable during its request, then closes. Both the
100-render isolation fixtures and outside-Devtools/prepass cases are **unrun**.

The same candidate host boundary now covers realm graph recording, retained
browser-hook methods and the compatibility panel API, not just Signal inspection.
The new 100-render fixture checks both actual prepass execution/output and async
factory access, with assertions outside swallowed component error handlers. It
also proves only by **authored assertions**, not execution, that request attempts
cannot clear outside graph/panel data or retain panel callbacks. Explicit local
RuntimeGraph instances remain user-owned; explicit internal process reset is global.
