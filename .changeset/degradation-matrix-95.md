---
---

#95: graceful-degradation matrix — fixture + spec + contract (code-first, unrun).

New `e2e/degradation-fixture.html`: the defined behavior matrix (header
comment) — default local driver + explicit indexeddb storage with read/write
probes recorded to `__ZENITH_DEGRADE__`, guarded SW registration against
`/e2e/degradation-sw.js` (scope `/e2e/__degradation_scope__/`, a path with no
pages), and a genuinely usable `<noscript>` block (heading + explanation +
working links — never a blank page). Importmap mirrors the proven xss-fixture
map plus `@zenith/storage` for the transitive closure.

New `e2e/degradation-sw.js`: scope-holder with NO fetch handler
(`skipWaiting` + `clients.claim` only) — it cannot serve stale bytes to other
specs even if the scope ever matched; the fixture unregisters it after
recording.

New `e2e/degradation.spec.ts`: six modes, capabilities blocked BEFORE page
code runs — default (local rw + SW registered), SW route-aborted (boot
continues, `failed:*`), `delete window.indexedDB` (indexeddb→memory fallback,
rw ok), throwing localStorage/sessionStorage (default→memory, rw ok),
QuotaExceededError-on-write except the driver probe key (set() never throws;
write honestly dropped, `readOk:false`), and `javaScriptEnabled:false`
(noscript visible, body text > 200 chars, ≥2 links). EVERY mode asserts zero
pageErrors (the no-unhandled-exception criterion); console warnings are
deliberately NOT gated — ZEN-1101/ZEN-1102 warnings are the required safe
error reporting.

Tests: `scripts/test/degradation-matrix.test.mjs` (noscript content, storage
importmap entry, SW contamination-freedom, one spec case per mode, no
console-noise gating).

No product fix was needed: construction-time unavailability → memory via
ZEN-1101, write-time quota → evict-oldest/drop via ZEN-1102 without throwing,
IDB open failure → async fallback in `ready`, SW register guarded — all
pre-existing and now pinned by the matrix.

NOT done here (validation phase, needs dist builds + browsers): run the spec
on Chromium/Firefox/WebKit, then extend the matrix to the real demos/SSR/
templates (#114/#174/#158). Private-mode quota persistence loss across reload
is documented in the fixture matrix, not re-tested here.
Validation must: run new vitest + Playwright spec on all three engines,
confirm the quota case reports `readOk:false` (not a silent pass).
