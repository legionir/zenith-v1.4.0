---
'@zenith/security': patch
---

#63: strict-CSP + TrustedTypes browser fixture and violation gate (code-first, unrun).

New `scripts/csp-fixture-policy.mjs` (pure, unit-tested): `buildStrictCspHeader`
(enforced policy — per-response nonce, `'strict-dynamic'`, no unsafe-eval /
unsafe-inline, `require-trusted-types-for 'script'`, `trusted-types zenith`,
`report-uri` + `report-to`), `injectFixtureNonce`, reporting-endpoints helper,
and the fixture/report route constants. Covered by
`scripts/test/csp-fixture-policy.test.mjs` (policy shape pinned so a future
edit cannot silently weaken it).

New `e2e/csp-fixture.html`: served ONLY by `scripts/e2e-server.mjs` with the
enforced header (never report-only/meta). It exercises the real product path
(`createTrustedTypesPolicy` + `setSafeInnerHTML` sanitized render with an XSS
payload that must not execute), probes Trusted Types capability explicitly
(`ttSupported`/`ttBlockedRawSink`/`ttEnforced` — non-TT browsers report
capability instead of faking support), runs a raw-sink positive control, and
forwards every `securitypolicyviolation` to the server collector via
sendBeacon. `?violate=1` appends a nonce-less script as the negative control.

`scripts/e2e-server.mjs` (surgical, existing routes untouched): per-response
`randomBytes(16)` nonce injection, enforced CSP + Reporting-Endpoints headers,
`POST /e2e/csp-report` collector (capped in-memory, supports csp-report and
Reporting-API shapes), `GET /e2e/csp-reports` listing, `DELETE` clearing.

New `e2e/csp-strict.spec.ts`: zero-violation gate (header assertions,
header↔HTML nonce match, sanitized render works, payload blocked, no in-page
violations, no server reports, no page errors, no CSP console noise;
Chromium asserts TT enforcement, other engines assert the honest control) plus
the negative-control test (violating script blocked AND in-page event AND
server report — the harness provably trips).

`docs/CSP-GUIDE.md` §8 documents the executed policy verbatim and how to run
the fixture. NOT done here (recorded remainder): sweeping runtime/compiler /
SSR / Vite / #158 templates for inline handlers and nonce-less assets, running
two demos plus SPA/PWA/SSR templates under the policy, and CI browser runs —
all validation-phase work requiring built dists and real browsers.
Validation must: `node scripts/e2e-server.mjs` smoke (fixture/report routes),
run the new vitest file, run the Playwright spec on Chromium/Firefox/WebKit,
confirm the negative control fails-closed when reporting is disabled.
