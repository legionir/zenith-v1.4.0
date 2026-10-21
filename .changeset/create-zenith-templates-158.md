---
'@zenith/templates': minor
'@zenith/create-zenith': minor
'@zenith/cli': patch
---

#158: standalone data-driven templates and `create-zenith` executable.

New `@zenith/templates` (tooling, dual, node target): the five project
templates (spa/ssr/pwa/dashboard/minimal) now live as real files under
`templates/shared/` plus per-kind overlays — no nested escaped literals —
with a `scaffoldProject` engine (manifest, tokens, force/dry-run, traversal
containment, injectable host), canonical `validateProjectName` (moved from
`@zenith/cli`, AUDIT CLI-03 rules unchanged) and a pinned version table.
`@zenith/cli` keeps the same per-file content through facades (`templates.ts`,
`templates/manifest.ts`, `validate-project-name.ts`); its literal template
modules are deleted. `getTemplateManifest` behavior (keys, escaping, kind
mutations) is unchanged and covered by the existing CLI manifest tests.

New `@zenith/create-zenith` (tooling, dual, node target, `create-zenith` bin):
full flag matrix (`--template`, `--pwa`, `--pm npm|pnpm|yarn|bun`,
`--install/--no-install`, `--git/--no-git`, `--force`, `--dry-run`, `--yes`,
`--json`, `--ts`), 0/1/2 exit contract, stdout-data/stderr-diagnostic split,
argv-array installs (no shell), traversal-safe writes, git-failure warnings.

Decisions: package named `@zenith/create-zenith` (dir `create-zenith`,
pre-registered in the layer map) so every current gate stays green; the
unscoped `create-zenith` publish name and `npm create @zenith` mapping stay
with the #77 owner decision (rename is mechanical). `.gitignore` is the only
code-inline template (dotfiles cannot live under `src/`). The CLI version
table is duplicated, not shared (build-time define is CLI-only); #109 unifies
them. `--js` is rejected (exit 1): only TypeScript templates exist.
`templates/` is added to the tarball allowlist as shippable content.
Validation must: build both packages, run the new tests, regenerate
`docs/api` snapshot/pages and `*.api.md`, run publint/attw/pack/install gates.
