---
---

R05/R07 report corrections — static parts (code-first, unrun).

R01/R02/R03/R04/R06/R08 need live runs (SHA/CI counts) or owner input and
stay evidence-gated in the validation phase; R01's historical-baseline
headers are already in place (`AUDIT.md`, `PRODUCTION-READINESS.md`), and
R04's expose-gc contradiction was already fixed under #86. This changeset
covers only the static corrections that changed under this session's code:

- `docs/CSP-GUIDE.md` §9 (R05.3): the shipped extension-pages policy
  (verbatim, `style-src 'self'`, zero unsafe-inline) and the VS Code
  webview nonce policy (verbatim template), both matching the #67
  implementation; Trusted Types scoped to browser pages/fixture.
- `docs/A11Y-AUDIT.md` (R05.1–R05.2): the intro no longer claims a
  complete audit; ✅ = unit/integration-tested behaviors, manual
  screen-reader/AT + keyboard-only passes deferred to validation, and
  "zero serious axe" scoped to the automated axe-core gate.
- `scripts/generate-api-docs.mjs` (R07.1): INDEX template states the
  inventory's limited role (symbol/kind/tag drift gate) and points at the
  TypeDoc reference site for full signatures/options/examples (flows into
  the validation regen).

Deliberate non-goals (validation/owner): live status tables with SHA/run
outputs (R01/R02/R08), inventory-count reconciliation from a real regen
(R03), benchmark method proof runs (R04), owner/external status alignment
(R06), doc-example marker coverage runs (R07.2–R07.3), and the #176–#186
management closures (evidence + authority required).
