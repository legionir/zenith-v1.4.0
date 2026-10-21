---
---

#103: TypeDoc reference + API inventory gates (code-first, unrun).

Recon: no TypeDoc anywhere (no dep, no config); `generate-api-docs.mjs`
produces symbol/kind/tag tables (its "TypeDoc-Style" header comment is
aspirational, not a full reference); hardcoded "تمام ۴۳ پکیج" in both
`docs/api/INDEX.md` and the generator while the tree has 60+ publishable
packages (~11 missing from the committed INDEX: a11y, adapter-edge/node,
analytics, eslint-plugin, head, mock, realtime, testing-e2e, ui, …);
`defaults-tsdoc` covers frozen DEFAULTS only; no general link checker
(only ADR DEC-links + root-README relative links); ADR-0013 documents
`docs:api -- --check` as a CI gate but `main.yml` never ran it.

Implemented:

- `typedoc.json` (new): entryPoints `packages/*/src/index.ts`, out
  `docs-site/api`, `npm run docs:reference` (new script) + `typedoc ^0.26.11`
  devDep; `f-gitignore` ignores `docs-site/`.
- `f-github/workflows/docs-pages.yml` (new, mirrors `demos-pages.yml`):
  push-main + manual, build libraries (cross-package imports resolve via
  dist) → `docs:reference` → Pages artifact `docs-site/`; latest-only
  versioning by design (per-release versioned dirs = owner decision).
- `scripts/generate-api-docs.mjs`: INDEX header count is now dynamic
  (`${packageCount}` from the surface; no hardcoded ۴۳ — pinned by test).
- `scripts/check-doc-links.mjs` (new, `npm run check:doc-links`):
  relative-link existence + `#fragment`-vs-heading audit (GitHub slug
  rules, unicode-aware) over `docs/api/**/*.md` + both README entry
  points; fenced/inline code skipped; http(s)/mailto/data skipped.
- `scripts/test/docs-coverage.test.mjs` (new, source-only): surface covers
  every publishable package; INDEX count == rows and covers surface; every
  row links a committed page; generator has no hardcoded count; typedoc
  wiring committed; READMEs link the inventory; link audit clean.
- CI (`f-github/workflows/main.yml`, `deps` job): `npm run docs:api --
  --check` (was documented in ADR-0013 but never wired) +
  `npm run check:doc-links`.
- Entry points: root README + `docs/README.md` link `docs/api/INDEX.md`
  and the hosted reference (`https://legionir.github.io/zenith-v1.4.0/api/`
  — adjust if the repo slug differs); ADR-0013 gate table + Links updated.

Deliberate non-goals (validation/owner): run the regen
(`node scripts/generate-api-docs.mjs` — adds the ~11 missing rows/pages
and refreshes the snapshot; the new coverage test is red until then, by
design) + `npm run docs:reference` after `npm ci` + new vitest files +
`check:doc-links` CLI; real Pages deploy + URL check; per-release
versioned reference dirs; fragment links into generated TypeDoc HTML
(not audited — upstream output); `docs/README.md` "۴۱ پکیج" line untouched
(different claim about workspace packages, out of scope).
