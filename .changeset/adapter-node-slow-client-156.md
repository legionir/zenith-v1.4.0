---
---

#156 remainder: slow-client socket budget on the Node server (code-first, unrun).

The handler already bounds render/abort (loader+render+delivery deadline with
503, client-disconnect abort, backpressure via pipeline), and shutdown drains
with a deadline — but nothing capped header receipt or the whole request, so
a trickling client could hold a socket indefinitely (Node's own generous
60s/300s defaults applied silently).

- `NodeServerOptions` gains `headersTimeout` (default 10000) and
  `requestTimeout` (default 30000, 0 disables per Node semantics), validated
  exactly like the other timeouts (finite, 0..2147483647) and applied to the
  underlying `http.Server` at creation. Render-phase hangs stay under the
  handler `timeout` (503) — socket budgets and the render deadline are
  documented as orthogonal. Both keys are destructured out before
  `createNodeHandler`, so the handler schema never sees them.
- README documents the budget in the servers section.
- Tests (written, unrun) in `packages/adapter-node/test/node.test.ts`:
  defaults + explicit values land on `server.headersTimeout/requestTimeout`
  without listening, three invalid overrides throw, and a raw-socket
  slow-headers connection (headers stall vs `headersTimeout: 100`) is
  destroyed by the server with no 200 (3s backstop; ~100ms server kill).

No export-shape change (interface members only — snapshot untouched).
NOT done here (validation phase): run the adapter-node suite (loopback on
127.0.0.1), typecheck, and real-consumer runs against Express/Fastify apps.
