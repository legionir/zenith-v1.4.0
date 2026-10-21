---
---

#157: edge independence — static closure gate for `ssr/edge` (code-first, unrun).

Recon (static source survey, no runs): the `ssr/edge` entry is edge-safe by
construction — explicit `Document` from the caller, no Node barrel, no ALS,
no DOM implementation (per its own header). Verified clean by hand-walking
the full transitive workspace closure:

- edge → runtime-core, head, scheduler, shared, errors, state,
  ssr/request-state.ts (the only other ssr/ file in range);
- second level → logger, schema, a11y, ui/position, expressions, security,
  cache — zero `node:` imports anywhere, zero AsyncLocalStorage/async_hooks
  mentions, zero DOM-implementation imports;
- router is NOT in the static closure (its `node.ts` subpath and the lazy
  `node:async_hooks` acquisition in `als-holder.ts` stay out of edge
  bundles); `ui/position.ts` pulls only shared/errors; ambient-DOM uses in
  range are `typeof`-guarded.

New gate `scripts/test/edge-independence.test.mjs` (written, unrun): resolves
the static workspace closure from `edge.ts` and asserts (1) it is non-trivial
and contains request-state, (2) no Node builtins in range, (3) the only ssr/
files in range are `edge.ts` + `request-state.ts`, (4) no DOM implementation
in range. Deliberately static-only: dynamic `await import()` branches
(hydrate routing, jsdom fallback) run solely on opt-in paths with their own
guarded fallbacks — following them would gate half the monorepo on edge and
false-fail.

No product code changed. NOT done here (validation phase): run the new
vitest file, plus real edge-runtime execution (Deno probe / workerd-style
run) proving the entry boots without Node globals.
