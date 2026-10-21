---
'@zenith/adapter-node': minor
---

Add structural Express/Fastify adapters over the canonical Node handler: `toExpressMiddleware`/`createExpressMiddleware` and `toFastifyHandler`/`createFastifyHandler` with framework-miss semantics (Express `next()`, Fastify `callNotFound()` after `hijack()`). No framework is imported or required as a dependency; the shared template outlet, request ownership, timeout/abort, compression/backpressure, CSP nonce and redacted-error contract are unchanged.

No version bump or publication has occurred. Framework loopback/contract tests are written but unrun; real Express/Fastify consumer runs, the measured slow-client memory budget and full package/API/budget gates remain pending validation. This is not card completion evidence for #156.
