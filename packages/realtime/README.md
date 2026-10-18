# @zenith/realtime

Isolated, typed WebSocket/EventSource clients. No connection is opened by an SSR
import or by server-side `autoConnect`; call `open()` explicitly with an injected
transport on server runtimes without native WebSocket/EventSource.

```ts
import { createRealtime } from '@zenith/realtime';
const client = createRealtime({ url: 'wss://example.invalid/events', autoConnect: false });
const stop = client.subscribe('news', message => { /* update application state */ });
client.open();
client.send({ topic: 'subscribe', channel: 'news' });
stop();
client.dispose();
```

`status` changes to `open` only on the native transport open event. JSON is the
standalone default; `parse: 'text'` accepts text services. The HTTP legacy facade
preserves raw-string sends and text parsing. Test delivery is available only from
`@zenith/realtime/testing`; it never claims that a connection opened or a frame
was sent. The deprecated HTTP mock method delegates to this test path.

Options/defaults are exported as `DEFAULTS` and `realtimeOptionsSchema`. Queue
capacity defaults to 100 frames, history to 50 messages (0 disables retention),
message size and native send buffer ceilings to 1 MiB. Exceeding bounds throws a
structured ZEN error. EventSource is receive-only; `send` rejects. Topic envelopes
use `{ topic: string, ... }`; named SSE events can also be subscribed to.

Reconnect defaults: unlimited consecutive failed attempts, 1000 ms initial delay,
factor 2, jitter 0.3, 30000 ms maximum. Inject `clock` and transport factories for
deterministic tests. Heartbeat is disabled by default; when enabled, any incoming
frame acknowledges liveness. Manual close/dispose/abort cancels reconnect and
heartbeat timers and detaches native handlers. Disposal is idempotent.

Authentication is asynchronous and defaults to a first WebSocket message, before
queued application frames. Query-string tokens require explicit `authMode: 'query'`.
EventSource authentication requires query opt-in or externally configured cookies;
it never silently places first-message tokens in a URL. Unsafe remote `ws/http`
URLs are rejected unless development is explicitly enabled or `allowInsecure`
is explicitly set; loopback is permitted. Credentials are never placed in error
reports. Custom parser/subscriber failures cannot expose raw frames through logs.

## Implementation status

Transport code and unit/loopback/browser acceptance tests are written but **not
executed in this implementation phase**. This is not a production-readiness or
size-budget claim. Full package acceptance, metadata generation,
actual size measurement and final validation remain in the remediation ledger.
The original `scripts/repro/realtime-transport.mjs` assertion is retained unchanged.

## App integration (written, not validated)

```ts
import { createApp } from '@zenith/runtime-core';
import { realtimePlugin } from '@zenith/realtime';
const app = createApp({ state: { endpoint: 'wss://example.com/feed' } });
app.use(realtimePlugin({ reconnect: true }));
// <section zen-ws="endpoint" zen-state="feed">
//   <output zen-text="feed.status"></output>
// </section>
```

`zen-ws` / `zen-sse` publish a scoped signal containing `status`, `message`,
`messages` and `error`; the default name is `data`. Here `zen-state` names output,
it is not a JSON local-state declaration. `zen-realtime-topic` filters message
state/events. Reconnect boolean/duration, comma-separated protocols, parse,
history, reactive send and schema-checked JSON options are supported. JSON values
are parsed through the shared attribute helper, with sanitized validation errors.
A raw absolute URL or an expression yielding one is accepted. DOM events bubble
as `zen-realtime-open/message/close/error`; attach ordinary listeners or the App's
`zen-action:<event>` bindings. SSE remains receive-only.

Bindings and their DOM-removal observers own subscriptions/effects/clients; App
teardown, plugin teardown and binding replacement are idempotent. Structural
transport bindings should wrap other structural directives, not share an element
with `zen-if`/`zen-for`. `REALTIME_DIRECTIVE_META` supplies metadata; compiler and
generated-manifest parity still need the final whole-inventory work for #120.

## Reentrancy and message ownership (candidate continuation)

Transport factories, serializers/parsers and observers can close, dispose or
reopen a client. A factory result acquired after release is closed immediately;
old-generation parsing, auth draining and notifications do not target a new
connection. A close callback that opens a new transport does not have that new
transport torn down by the old close path. An ambient SSR document prevents
`autoConnect` even if an SSR Window is present.

Blob decoding preserves wire order with subsequent text/binary messages. Pending
frames are released when their generation retires; obsolete decoders cannot block
a new generation. The pending decode queue is bounded to 100 frames and
`maxBufferedAmount` bytes (in addition to the in-flight frame's message-size
limit); overload retires the generation with `ZEN-1704`. This extends the existing
buffer ceiling to receive decoding and must be reviewed as a compatibility change.

Reentrant transport/Blob fixtures and integration through the public `@zenith/mock`
WebSocket constructor have been written, not executed. These are not proof of the
≤5 KB budget or completed #154 acceptance.
