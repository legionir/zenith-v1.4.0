---
---

#100: RTL matrix completion (code-first, unrun).

Recon: most of the matrix predates this card — date-picker resolves the
effective direction (explicit dir → locale fallback, dir/lang observer,
RTL-flipped APG calendar keys and nav glyphs), virtual-list horizontal RTL
(explicit → inherited → computed, logical anchoring), menu submenus + APG
submenu keys, popover/tooltip positioning, shared roving tabindex, tabs RTL
pin in `ui.test.ts`, and `bidi-intl-rtl.test.ts` (Intl formatting, bidi
isolation, `resolveHorizontalStep`). The genuine remainder was the
data-table grid: `ArrowLeft/Right` ignored direction.

Implemented:

- `packages/data-table/src/grid.ts`: `gridRtl()` (explicit → inherited →
  computed, same resolution as virtual-list/a11y; steps identical to the
  canonical `resolveHorizontalStep` in `@zenith/i18n`, inlined so
  data-table keeps its dependency surface — no new dep) read per keydown,
  so a runtime dir switch flips with no re-render; Up/Down untouched.
- `packages/data-table/test/grid-rtl.test.ts` (new, jsdom, unrun): LTR
  order, explicit `dir=rtl` flip, inherited dir, runtime switch without
  re-render, vertical neutrality.
- `packages/ui/test/date-picker-rtl.test.ts` (new, jsdom, unrun): explicit
  dir overrides the locale default both ways, locale fallback both ways,
  runtime dir-switch re-render via the MutationObserver, and APG calendar
  keys in both directions (activeElement `aria-label`).
- `packages/notifications/test/notifications-rtl.test.ts` (new, jsdom,
  unrun): `renderAccessibleToast` under `dir=rtl`/`ltr` — identical
  role/live/message/close structure, mixed bidi message verbatim, no
  physical dir override (inherits).
- `packages/virtual-list/test/horizontal-rtl.test.ts` (new, jsdom, unrun):
  inherited-dir horizontal RTL (right-anchored, negative translateX).
- `scripts/test/rtl-matrix.test.mjs` (new, source-only): every matrix cell
  has both-direction tests; APG flips present in all keyboard owners
  (grid/date-picker/menu/roving); no hardcoded container dir; toasts never
  override dir.

Deliberate non-goals (validation/owner): run all new + existing direction
suites on Chromium/Firefox/WebKit with pinned `fa`/`ar`/`en` locales and
`TZ=UTC` (flakiness gate per acceptance); fixed-font/viewport screenshot
proofs for the matrix (no screenshot harness in-repo — owner decides tool);
notification positions stay physical (`top-left` etc. are explicit config,
not direction bugs); per-demo RTL sweeps stay out of scope.
