---
---

#159: eslint-plugin adoption in scaffolded templates (code-first, unrun).

Recon: the plugin core predates this card (four configs
recommended/library/template/strict, `ruleContracts` table, local
`createOptionsObjectRule` factory, parse5+expression HTML processor with
original line/column mapping, JS template-literal diagnostics, 9 code rules +
12 template rules, RuleTester suites, root consumption in `eslint.config.mjs`,
per-rule Reject/Prefer table in the README). The true remainder was plan
step 4 — consumption in new templates — plus a source-only adoption gate.

Implemented:

- `packages/templates/templates/shared/eslint.config.mjs` (new real
  template file): `tseslint.config(ignores + recommended + library +
  template)` from the published `@zenith/eslint-plugin`.
- `packages/templates/templates/shared/package.json`: `lint: eslint .`
  script, `@zenith/eslint-plugin: __ZENITH_ESLINT_PLUGIN__` devDep (pinned
  via the existing versions table — `@zenith/eslint-plugin 1.5.0` was
  already there), registry `eslint ^9.39.4` + `typescript-eslint ^8.71.1`
  (same ranges as the root).
- `packages/templates/src/engine.ts`: `__ZENITH_ESLINT_PLUGIN__` token in
  `renderContent`, `eslint.config.mjs` appended to `BASE_FILE_ORDER`
  (historic order preserved; the disk==manifest test auto-covers the new
  file on all 5 kinds).
- `packages/templates/templates/shared/README.md`: `npm run lint` bullet.
- `packages/templates/test/templates.test.ts`: new `it` — every kind ships
  the config (library+template), a caret-pinned plugin dep, eslint +
  typescript-eslint devDeps, the lint script, and zero leftover `__TOKENS__`.
- `scripts/test/eslint-adoption.test.mjs` (new, source-only): four configs
  published; contracts cover all 9 code rules + the templateRules spread;
  ≥5 valid + ≥5 invalid RuleTester cases per code rule, per template rule
  (parsed from the one-line-per-rule fixtures — loud on format drift), and
  for the main options-object run; root wires template rules + the html
  processor; every scaffold carries config + pinned dep + script with the
  engine token resolved through the versions table.
- CI `templates-e2e` job: `Lint every template fixture` step — `npm run
  lint` in all five built fixtures (green proof on real installs).

Deliberate non-goals (validation/owner): run the new vitest its + the
source-only gate; run the fixture lint step live (scaffold `main.ts`
`as`-casts and template HTML must lint clean under the published configs —
drift means fixing the scaffold or the config, not weakening the gate);
deliberate-violation red proof for root + fixture lint (validation runs an
intentional `console.log` / `zen-foo` and watches the gate go red);
`npm run lint` is not part of fixture `build` (matches root separation).
No #33 rework: fixture install/build/preview/start scripts are untouched;
the added devDeps ride the existing tarball-rewrite + install path.
