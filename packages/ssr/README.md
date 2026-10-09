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
  }
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

const dispose = hydrate('#app', {}, {
  validateChecksum: true
});

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
