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
import { hydrate } from '@zenith/ssr';

const dispose = hydrate(
  '#app',
  {},
  {
    validateChecksum: true,
  },
);

// Cleanup if needed
dispose();
```

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
- `hydrate(root, state?, options?)` — Hydrate server-rendered HTML
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
not evidence of a deployable Cloudflare/Deno Edge adapter. Separate adapter
packages, Edge runtime/deployment tests and the remaining #156/#157 contracts
remain pending.
