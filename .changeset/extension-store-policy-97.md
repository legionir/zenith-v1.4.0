---
---

#97: store package code part — privacy policy ships in the ZIP (code-first, unrun).

Recon: step-1/2 code surface already existed — deterministic ZIP
(`lib/zip.mjs`: fixed 1980 stamps, sorted members), versioned
chrome/firefox builds with `browser_specific_settings` (gecko id +
`data_collection_permissions: ['none']`), version-drift check, and the CI
`tools` job (build + `--package` + artifact upload). All three manifest
permissions are genuinely used (`activeTab`/`scripting` for the active-tab
hook read, `notifications` for local state alerts) — nothing to trim. The
genuine remainder: no public privacy policy existed, and the policy text
was not part of the installable package.

Implemented:

- `tools/devtools-extension/PRIVACY.md` (new, versioned 1.4.0): collects
  nothing / transmits nothing / stores nothing; permission-justification
  table (`activeTab`, `scripting`, `notifications`,
  `optional_host_permissions`) with code references; no `host_permissions`;
  Firefox zero-data-collection note; store-link + SECURITY pointers.
- `scripts/build-tools.mjs`: ships `PRIVACY.md` inside both browser
  packages (next to `LICENSE`/`README.md`) so store pages link the exact
  installed text.
- `scripts/test/tools-build.test.mjs`: fixture + assertion pin the policy
  file in the built `chrome/` package.
- `scripts/test/extension-store.test.mjs` (new, source-only):
  least-privilege manifest shape (exact permission set, no silent hosts,
  version/name/description present), every permission + optional host
  documented in `PRIVACY.md`, headline no-collection promises present, and
  the build wires the policy file + Firefox none-collection declaration.

Deliberate non-goals (WAITING-OWNER + validation): install the ZIPs in
clean Chrome/Firefox profiles and exercise real message/inspection flows
with screenshots (step 3); Chrome Web Store + AMO submission, review
feedback, and the final store URLs (step 4); run new + existing suites.
