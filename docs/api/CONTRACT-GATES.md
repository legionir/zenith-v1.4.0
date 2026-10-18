# Declaration contract gates — implementation status

Date: 2026-10-16. Code-first remediation for #38/#56/#57. **Not validated.**

- `npm run api:report`: API Extractor writes reviewed `docs/api/reports/*.api.md`
  and a declaration signature snapshot from actual built public entries/subpaths,
  including distinct ESM/CJS declaration formats.
- `npm run api:check`: checks reports and signature drift against those baselines.
- `npm run api:strict`: additionally fails public declaration `any`, unclassified
  exports and internal leakage outside an internal entry. Referenced workspace
  declarations are followed; external TypeScript/DOM/dependency anys are not
  relabelled as ours. Missing or unresolved owned declarations fail rather than
  reporting a clean surface. Node ambient types resolve from the repository.

The new `api-contracts` CI job and publication preflight call the strict gate.
**Reviewed baselines have not been generated and legacy any/release-tag debt is
not yet migrated. The new gate is expected to remain blocking until that work is
finished.** No allowlist, warning-only CI setting or silent missing-baseline skip
is used to claim completion. Do not push this code-first work as a green candidate.
Baseline generation requires the final build and review after implementation;
it is intentionally not run in the current phase.

Per-entry build target overrides live in `package.json` under
`zenith.entryTargets` (for example testing-e2e's Node root and browser handshake).
Unknown targets fail. Only the `zenith` umbrella's `./browser` creates the special
`window.Zenith` IIFE; a tooling subpath with that name does not acquire that footer.
Production defines cover both bare `__ZENITH_DEV__` and
`globalThis.__ZENITH_DEV__`. Full condition/bundler/worker/packed-consumer matrix
acceptance remains open under #57; target selection alone does not prove it.

Generated JSON/model/review artifacts go under ignored `artifacts/api-reports/`
with 14-day CI retention. Only intentionally reviewed reports/snapshots belong in
Git. This file is neither a fabricated API baseline nor a completion record.
