---
"@zenith/a11y": minor
"@zenith/head": minor
"@zenith/ui": minor
"@zenith/adapter-node": minor
"@zenith/mock": minor
"@zenith/runtime-core": major
"@zenith/runtime": patch
"@zenith/notifications": patch
"@zenith/transition": patch
"@zenith/ssr": major
"@zenith/testing": patch
"zenith": minor
---

Extract shared accessibility and headless UI primitives with compatible runtime
focus/position/date-picker/portal facades. Add explicit reactive head ownership,
secure serialization and per-request factory App teardown. Remove the SSR
last-created global head; outside a render request callers must pass a manager.
Expose reactive head/a11y/UI in the full preset and umbrella namespaces.

Add Node static/server lifecycle helpers over the canonical SSR engine, whole
request deadlines, response-owned JSON-LD/hydration nonces and redacted public
adapter errors. Add REST/WebSocket/Service Worker mocking with safe nested global
leases and reuse the engine from the legacy testing facade.

This is release metadata, not acceptance evidence. All new code/tests remain
unvalidated until the remediation code-first phase is complete. New-package
publication, major compatibility review and all G/P gates are still pending.
