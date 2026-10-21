---
---

#88: lazy heavy directives (code-first, unrun).

Recon: `walk-tree.ts` statically imported `processVirtualRepeat` and
`processDatePicker` (the latter drags all of `@zenith/ui` into every app's
entry). crud/data-table processors were never eager in the walker
(consumer-registered), so the plan's list reduces to the two real eager
weights plus a generic path for higher layers.

Implemented:

- `packages/runtime/src/directives/lazy.ts` (new): `LazyDirectiveSpec`
  registry (`register` with validation + idempotent identity-guarded
  Cleanup, `unregister`, `list`, internal lookup), single-flight
  `ensureLazyProcessor` (rejections dropped → next discovery retries),
  `getLoadedProcessor` sync read, `preloadLazyDirectives` (SSR),
  `lazyDirectiveManifest` (name → discovery rule → chunk hint),
  `isLazyBound`, and `processLazyDirective` (loading/bound/error/
  cancelled `data-zen-lazy*` markers, `isConnected` + disposed guards,
  failures log without throwing out of the walker, #118-style reset via
  `onGlobalReset` restoring the built-ins). Built-ins: `zen-virtual`
  (attribute, dynamic `import('./virtual-repeat)`) and `zen-date-picker`
  (tag, dynamic `import('./date-picker')`) — the only static references are
  `import type` (erased), so bundlers split both into independent chunks.
- `walk-tree.ts`: static heavy imports removed; `zen-virtual` and
  `zen-date-picker` branches take the cached sync path when preloaded
  (identical to eager) or the async marked path; plus a generic fallback
  (`matchLazyDirective` + `processExport`, e.g. `processCrud`) so
  consumer-registered directives (crud/data-table shaped) are discovered —
  the processor owns the subtree per the custom-directive convention.
- `exports.ts` publishes the lazy API; `walker.ts` re-exports
  `clearLazyDirectivesInternal`. Eager `processDatePicker` /
  `processVirtualRepeat` exports stay (no breaking change).
- `packages/runtime/test/lazy-directives.test.ts` (new, jsdom, unrun):
  registry + manifest, validation/idempotent removal, preload errors,
  no-load-without-discovery, date-picker walker discovery → async bind →
  same Farvardin calendar as eager (parity), bound-marker dedupe,
  single-flight, reject→error-marker→retry, detached/cancelled,
  dispose-before-load skip, preloaded sync bind, lazy/eager module
  identity, generic attribute discovery with configAttr passing, and the
  missing-export negative control.
- `scripts/test/lazy-directives-gate.test.mjs` (new, source-only):
  no value imports of the heavy modules in the walker (type-only),
  dynamic-only loading in the registry, facade + reset-hook wiring,
  eager exports kept, generic path present.
- `packages/runtime/README.md`: lazy-directives section (markers,
  preload, registration, entry-size/network-gate validation pointer).

Deliberate non-goals (validation/owner): run the new suites + gate;
real-bundler proof (per-entry chunks, no-download-without-directive
network test, single-fetch-on-first-use, eager/lazy behavioral parity in
a real browser, import-failure + hydration runs); entry-size measurement
recorded against `.size-limit.json`; snapshot/`*.api.md` regen for the
new exports; SSR preload e2e. crud/data-table self-registration stays
with their packages (consumer registration works today).
