# Zenith Public API Stability & Deprecation Policy (#58)

> **Status**: Normative (`DEC-019`, `DEC-026`, `#58`)  
> **Applies to**: All 44 `@zenith/*` packages in the monorepo (`packages/*/src/index.ts`).

---

## 1. Definition of Public vs. Internal API

1. **Public API (Stable Contract)**:
   - Every runtime symbol, function, class, constant, or TypeScript type/interface exported from a package's root entrypoint (`packages/<pkg>/src/index.ts`) or any subpath declared in `package.json#exports`.
   - Every documented `zen-*` HTML directive attribute and its documented modifiers.
   - Every error code registered in `@zenith/errors` (`ZEN-NNN`, `ZEN-NNNN`, `ZEN-DEPR-NNN`).
2. **Internal API (Non-Contractual)**:
   - Any symbol not re-exported by a declared `package.json#exports` entrypoint.
   - Any symbol, property, or global prefixed with `_` or `__zenith_` (except the versioned `window.__ZENITH_DEVTOOLS_HOOK__` protocol in `@zenith/devtools-core`), or annotated with `@internal`.

---

## 2. Semantic Versioning (SemVer) Guarantees

All `@zenith/*` packages are versioned in **lockstep** (`DEC-026`) and adhere strictly to Semantic Versioning (`MAJOR.MINOR.PATCH`):

| Release Type | Allowed Changes | Prohibited Changes |
|---|---|---|
| **PATCH (`x.y.Z`)** | Bug fixes, security patches, internal refactors, documentation/error message improvements. | Any breaking change, new public API, or new deprecation warning. |
| **MINOR (`x.Y.0`)** | Backward-compatible new features, new packages, new optional fields on options objects, and **deprecation** of existing APIs (with working aliases/fallbacks). | Removing or incompatibly changing any Public API symbol, signature, or runtime behavior. |
| **MAJOR (`X.0.0`)** | Removal of APIs that were deprecated in at least one prior `MINOR` release and documented in `docs/migration-guide.md`. | Removing an API without a prior deprecation cycle (except critical zero-day security vulnerabilities). |

---

## 3. Three-Stage Deprecation Lifecycle

Every deprecated Public API MUST go through three stages before removal:

1. **Stage 1 — Soft Deprecation (JSDoc + Docs)**:
   - Add `@deprecated` JSDoc tag on the symbol/overload with the `ZEN-DEPR-NNN` code, replacement API, and target removal version (`2.0.0`).
   - Register the code in `DEPRECATION_CODES` inside `@zenith/errors` (`packages/errors/src/core.ts`).
   - Add a migration entry in `docs/migration-guide.md`.
2. **Stage 2 — Dev-Mode Once-Only Warning (`deprecate()`)**:
   - Call `deprecate('ZEN-DEPR-NNN', oldName, replacement, hint?)` from `@zenith/errors`.
   - Warnings are emitted **at most once per code** per process/page load, and **only in development mode** (suppressed when `globalThis.__ZENITH_DEV__ === false`).
   - The deprecated API continues to delegate to the new implementation so existing code remains 100% functional.
3. **Stage 3 — Major Release Removal (`2.0.0`)**:
   - In the target major release (`removedIn: '2.0.0'`), the deprecated wrapper/alias is removed while keeping the `ZEN-DEPR-NNN` entry reserved in the catalog (never reused).

---

## 4. Standard `deprecate()` Helper

All runtime deprecations MUST use `deprecate()` from `@zenith/errors`:

```ts
import { deprecate } from '@zenith/errors';

/**
 * @deprecated Use `clearHttpCache` instead (ZEN-DEPR-005, removed in 2.0.0).
 */
export function clearCache(tags?: string[]): void {
  deprecate('ZEN-DEPR-005', 'clearCache (http)', 'clearHttpCache');
  clearHttpCache(tags);
}
```

---

## 5. Active Deprecation Registry (`ZEN-DEPR-001` .. `ZEN-DEPR-041`)

| Code | Deprecated API | Replacement | Removed In |
|---|---|---|---|
| `ZEN-DEPR-001` | `processVirtualList` | `createVirtualList` | `2.0.0` |
| `ZEN-DEPR-002` | `enterTransition` | `createTransition(name).enter(el)` | `2.0.0` |
| `ZEN-DEPR-003` | `leaveTransition` | `createTransition(name).leave(el)` | `2.0.0` |
| `ZEN-DEPR-004` | `animateGroup` | `createTransition(name)` shared controller | `2.0.0` |
| `ZEN-DEPR-005` | `clearCache (http)` | `clearHttpCache` | `2.0.0` |
| `ZEN-DEPR-006`..`015` | `@zenith/i18n` Jalali helpers | `@zenith/jalali` functions | `2.0.0` |
| `ZEN-DEPR-016`..`018` | `@zenith/form` schema adapters | `@zenith/schema/zod` & `@zenith/schema/json-schema` | `2.0.0` |
| `ZEN-DEPR-019`..`024` | `*.destroy()` lifecycle methods | `*.dispose()` (`Disposable` protocol, `#116`) | `2.0.0` |
| `ZEN-DEPR-025` | `schedule()` (`@zenith/scheduler`) | `scheduleEffect()` | `2.0.0` |
| `ZEN-DEPR-026` | `installStatefulComponents()` | `Zen.use(ZenithStatefulPlugin)` | `2.0.0` |
| `ZEN-DEPR-027`..`034` | `@zenith/state` DevTools registry functions | `@zenith/devtools-core` | `2.0.0` |
| `ZEN-DEPR-035`..`041` | Positional >2-arg overloads (`#55`) | Options-object signatures (`#55`) | `2.0.0` |
