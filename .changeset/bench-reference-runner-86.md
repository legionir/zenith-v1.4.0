---
---

#86: ≤5% reference runner + expose-gc doc fix (code-first, unrun).

New `scripts/bench-reference.mjs` (`npm run bench:reference`): the fail-closed
gate for the reproducibility claim, separate from advisory `npm run bench`.
Predefined plan (default 5 independent runs, each in a fresh child process via
the existing `--out` mode — `--runs < 5` rejected, so "minimum 5 independent
runs" evidence is structural, not procedural); fail-closed environment check
over node/v8/platform/cpuModel/cpuCores/domEngine (mismatch exits 2 with named
fields — no silent advisory downgrade); absolute per-run deviation vs baseline
for EVERY gated metric (a 6% speedup fails like a 6% slowdown; informational
metrics excluded from the verdict but counted; a gated metric missing from any
run fails closed); raw per-run evidence JSON at
`benchmarks/results/reference-*.json`; `--self-check` negative control proving
the gate passes clean runs and trips on an injected +50% deviation through the
same evaluation path.

Tests: `scripts/test/bench-reference.test.mjs` (pure verdict/CLI/env logic —
CLI floor, unknown flags, drift naming, absolute-deviation both directions,
one-drifting-run-out-of-five fails, missing-metric fail-closed, informational
exclusion, copy semantics) + a wiring test in `scripts/test/benchmarks.test.mjs`
(script value, README row, doc mentions, expose-gc fix).

Doc honesty fix (flagged in reconciliation): the memory section claimed
"(بدون `--expose-gc`)" while the method is a `node --expose-gc` child probe —
fixed identically in `scripts/generate-benchmarks-doc.mjs` and the generated
`docs/BENCHMARKS.md` (byte-verified), plus a reference-runner bullet and footer
mention in both. `benchmarks/README.md` command table extended.

NOT done here (validation phase, needs dist builds + reference machine): the
actual 5 reference runs with raw evidence, competitor build verification on
that machine, and any baseline re-record. The ≤5% criterion itself is
unchanged — no scope amendment claimed.
Validation must: `npm run bench:reference -- --self-check`, run the two
vitest files, `npm run check:bench-doc`, full 5-run reference on the baseline
machine, publish `reference-*.json` evidence.
