---
---

#90: Web Vitals gate — LHCI config + Playwright INP spec + budgets (code-first, unrun).

New `scripts/web-vitals-budgets.cjs` (single source of numbers, CJS so both
consumers read it): BUDGETS (LCP 2500ms, INP 200ms, CLS 0.1, Performance 0.9,
5 predefined runs), PROFILE (4x CPU, 4G: rtt 150ms / 1638Kbps, CDP byte units
included), VITAL_URLS (ecommerce-demo + dashboard on the e2e server), plus
pure `summarizeRuns` (pre-specified median) and `checkVitals` — which FAILS a
missing INP explicitly instead of reporting zero (no TBT substitution, no
interaction-less pass).

New `lighthouserc.cjs`: LHCI gate for what navigation-mode Lighthouse CAN
measure (Performance/LCP/CLS, error level, 5 runs, devtools 4x/4G mobile
profile, `startServerCommand: node scripts/e2e-server.mjs`, filesystem
artifacts to lhci-artifacts/). Deliberately NO INP assertion — navigation
mode observes no real interaction; INP is owned by the Playwright flow.

New `e2e/web-vitals.spec.ts` (Chromium-only, explicit skip elsewhere):
per-demo 5 runs × 120s; CDP CPU/network throttling with the shared numbers;
buffered LCP/layout-shift/event observers via addInitScript; scripted flow
(real buttons/inputs/in-demo link first — every action recorded, zero REAL
controls = explicit fail); first-view snapshot before navigation (navigation
wipes the buffer; observers re-install automatically); INP = p98 of
per-interaction worst durations; missing LCP/INP or zero real controls fail
loudly; per-run JSON artifact via test.info().outputPath (actions, both
views, summary, diags).

Tests: `scripts/test/web-vitals-budgets.test.mjs` (thresholds, profile both
unit systems, verdict incl. boundaries + inp-missing + median, and the
no-drift suite: lighthouserc reads BUDGETS symbols / no INP assertion /
filesystem artifacts; spec carries identical numbers/urls + missing-timing
fails; `web-vitals` npm script wired). `package.json`: `web-vitals` script.

NOT done here (validation phase, needs dist builds + reference machine +
demos' /api backends): LHCI autorun on both demos, `npm run web-vitals`,
deliberate-regression proof (e.g. +500ms blocking script turns both gates
red), font/cloak/shift/JS/chunk remediation with before/after on the same
profile, CI job with artifact upload. Suggested CI (workflow not in this
snapshot): `npm run build`, `npx -y @lhci/cli@0.14.0 autorun`, `npm run
web-vitals`, upload `lhci-artifacts/` + `test-results/` — Chromium pinned.
Validation must: both commands green on the reference machine, negative
control red, artifacts archived.
