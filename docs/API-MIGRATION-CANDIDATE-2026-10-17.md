# Shared API migration candidate — 2026-10-17

**Authoring, not acceptance.** Same 28-card scope. No test, typecheck, build,
measurement, generated report, CI, publication or issue closure is evidence for
these edits yet. Source compatibility and behavioral changes are not called
mechanical refactors. A major changeset is a proposal, not release approval.

## Compatibility ledger

| Change | Classification | Preserved / changed |
| --- | --- | --- |
| Auth engine / registry / functional facade / response and host helpers | Mechanical candidate (#40) | Constructor identity, event payloads, lazy previous-session reads, request generations and cleanup order intended unchanged. New boundary fixtures authored. |
| Form factory / store / advanced / wizard / validation modules | Mechanical candidate (#40) | Existing facade identities, validators, array behavior, timers and reset/touch state intended unchanged. No subclass mixins or public methods added merely to access private state. |
| Data cache extraction | Mechanical candidate (#40) | LRU backing store, age comparison, tags, invalidation hooks and data identity preserved by design. |
| Public `any` → unknown / correlated generics | **Source-contract change (#38)** | Consumers must narrow dynamic data; field validators retain inferred field types. Not an API-identical refactor, even when emitted JS is unchanged. |
| Token discriminated union / AST literal unknown | **Source-contract change (#38)** | Runtime token representation unchanged; interface augmentation / formerly unchecked value operations can require migration. Defensive parser text-token check is not labeled a pure move. |
| Router facade | Contract repair plus explicit behavior change | Full Signal facade uses a genuine Signal target and context-aware wrappers. Missing native request isolation now throws instead of borrowing shared route state. |
| Options overloads (#55) | Additive canonical APIs with deprecated bridges | Legacy operands remain available; canonical wrapper objects are validated. New warning codes 072–085 registered. Legacy cache TTL and cache-name/timer edge semantics are intentionally retained. |
| Declaration/release tooling (#38/#56) | Gate correctness change | Missing declarations, unclassified/conflicting tags and leaked any must fail; source-barrel regex is only an authoring inventory, never evidence of public API cleanliness. |

Bundle-size equality, declarations and timing/cleanup equivalence are **not yet
measured**. Auth/Form extracted implementation files are not a declaration that
all #40 targets meet their limits; Runtime/Core/CRUD/Resource remain in scope.

## Canonical calls and legacy bridges

```ts
getCachedData(url, { ttl: 60_000 });
setCachedData(url, data, { tags: ['users'] });
formatLocaleNumber(1234, { locale: 'en-US', intl: { maximumFractionDigits: 0 } });
formatCurrency(1234, { locale: 'en-US', currency: 'USD' });
formatDateTime(date, { locale: 'en-US', intl: { timeZone: 'UTC' } });
formatRelativeTime(-1, 'day', { locale: 'en-US' }); // value and unit are data
formatList(['one', 'two'], { locale: 'en-US' });
networkFirst(request, { cacheName: 'api-v1', timeout: 3000 });
cacheThenNetwork(request, { cacheName: 'api-v1', onUpdate });
applyStrategy('cacheFirst', request, { cacheName: 'api-v1' });
zenAnimate(element, { keyframes, duration: 300 });
animateGroup(elements, { direction: 'enter', name: 'fade', duration: 300 });
```

Data cache reads/writes return/store unknown. Read TTL is an age limit, not a
change to the shared cache's eviction TTL. Canonical TTL must be nonnegative and
finite; the deprecated numeric overload retains negative/infinite age behavior.
Currency retains the IRT/toman convention and existing defaults. Relative time
retains the `numeric: 'auto'` default only when Intl options are omitted.

Service Worker subpaths `@zenith/service-worker/sw` and
`@zenith/service-worker/strategies` now have explicit build/export entries.
Neither adds worker bootstrap code to the main-thread root. Both declared
formats need final consumer validation. A private legacy dispatch lease avoids
revalidating historical operands or issuing a second strategy warning.

## Router scopes and Node import

```ts
import { routeSignal } from '@zenith/router';
import { runWithRoute, runWithRouteSync } from '@zenith/router/node';

await runWithRoute('/request', async () => {
  await Promise.resolve();
  routeSignal.update(value => ({ ...value, params: { id: '1' } }));
});
runWithRouteSync('/sync', () => routeSignal.peek());
```

On Node hosts without synchronous `process.getBuiltinModule`, initialize native
ALS through the explicit Node entry or finish async initialization before using
a synchronous scope. The universal root has no static Node builtin import.
Request signals are disposed in `finally`; the browser singleton is not disposed
by a request. Extracted facade methods resolve at invocation, not at extraction.
The global symbol stores the native ALS **holder**, not a shared fallback request.
ESM/CJS copies share that holder and the browser route signal. Native availability
and dependency loading at every advertised Node floor still require the final
consumer matrix; this code does not justify dropping a Node floor.

## Public payload typing

HTTP generic defaults are unknown. Supplying `http.get<User>()` is still a
caller-declared trust boundary, not a runtime decoder; cache hits and legacy
response interceptors have the same boundary. Validate external JSON before
using it as domain data. SSR host DOM factories now use structural DOM
capabilities rather than a public `window: any`; no optional DOM implementation's
ambient any is advertised as Zenith's contract.

Action context data and argument lists are unknown. Prefer narrowing or retaining
a typed application-owned wrapper. Signal observer callbacks preserve their own
`T`; heterogeneous legacy registry references expose read capabilities instead
of claiming that an unknown signal can safely accept arbitrary writes.

## Explicit export levels

Release level is one of `public`, `beta`, `alpha`, `experimental`, `internal`.
`deprecated` is independent lifecycle metadata. Missing tags stay `unclassified`;
conflicting explicit levels stay `conflicting`. Aliases cannot launder an
internal implementation into public. The package root must declare public;
non-public subpaths can declare their intended level via
`zenith.entryLevels["./subpath"]`. `./internal` defaults to internal. Every real
declaration condition is inspected, including referenced workspace declarations,
module-shaped imports and inferred any. Unrelated private module declarations
are not treated as namespace exports.

**Open decisions/work, not waived:** existing root internal hooks in State/SSR,
Parser/Lexer exposure, Devtools integration hooks and umbrella re-exports still
need symbol-by-symbol classification and compatibility handling. This change
neither removes established root names without approval nor relabels them public
to turn the gate green. Default-public source docs are removed; old generated
reports/snapshots are intentionally stale until final generation and review.
Public-any zero and internal-any ≤100 remain unestablished across the complete
published graph. Form field/array views use actual readonly computed capabilities in the authored
candidate; nested/array generic payloads remain caller-declared. The Router repair
is not evidence of Form domain validation or computed lifecycle correctness.

## 2026-10-18 — #56 root-vs-public decisions (authored, not executed)

**Decision 1 — SSR host isolation moves to `@zenith/ssr/internal`.**
`domAls`, `getDOMGlobals`, `installDOMGlobalGetters`,
`isAsyncLocalStorageAvailable`, `createAsyncContextStore`, `getSSRRuntimeEnv`
plus types `AsyncContextStore`/`DOMGlobals` are host/adapter integration, not
public rendering API. Canonical home is the new `./internal` subpath
(`src/internal.ts`, ESM-only flat shape `types`/`import`/`default` registered in
the single subpath table `scripts/lib/exports-shape.mjs`, mirroring the table —
not the dual ESM+CJS shape of `@zenith/errors`/`@zenith/state` internals, so the
worker-targeted `./edge` entry stays ESM-only; the per-package dual flag cannot
express mixed shapes. The facade
re-exports the root self-specifier so each format keeps one ALS/singleton
graph). Origins carry their real `@internal` level. Root names stay as
classified compatibility bridges until removal is approved (2.0, DEC-026) —
the new subpath does not magically remove legacy root exposure, and nothing
was relabeled public to clear a gate. In-repo importers already use relative
paths (`./dom-context`); the only root consumer is
`ssr/test/concurrent-isolation.test.ts`, which keeps working through the bridge.

**Decision 2 — Parser/Lexer surface moves to `@zenith/expressions/internal`.**
`lex`, `TokenType`, `Token` (origins in `lexer.ts`/`token.ts`) and `Parser`
(`parser.ts`) are framework-developer surface. Canonical home is the new
`./internal` subpath (`src/internal.ts`, ESM-only flat shape, tabled in
`scripts/lib/exports-shape.mjs` under `@zenith/expressions`); origins carry
`@internal`; root names stay as classified
bridges. The only root consumers are expressions' own tests
(`expressions-eval.test.ts`, `fuzz-security.test.ts` imports from `../src/index`
— relative, unaffected). All cross-package importers use the canonical
`compile`/`evaluate`/`evaluateExpression`/`compileExpression` entry points.

**Decision 3 — one canonical public `hydrate`.**
`hydrate(root, init?)` from `@zenith/runtime-core` (already `/** @public */`,
re-exported by `@zenith/runtime`, `zenith/browser`, `zenith/core`) is the
canonical public hydration API. `hydrate(root, initFn?)` from `@zenith/ssr` is
a legacy same-name bridge: kept implementation, now `@public @deprecated`
with a once-only `ZEN-DEPR-108` warning pointing at the canonical form
(removal in 2.0). `startFromSSR` keeps delegating (single warning via the
bridge) and its TSDoc now points at the canonical form. SSR's `HydrationResult`
type is likewise `@public @deprecated`; the canonical type lives in
`@zenith/runtime-core`. The stale ssr README sample (`hydrate('#app', {},
{validateChecksum})` returning a disposer — a signature no implementation has)
was replaced with the canonical form. Registry entry `ZEN-DEPR-108` added.

**Classification note:** api:strict still fails on the retained root bridges
(internal-on-public-entry) by design — that is the removal backlog for 2.0,
not a waiver. Reviewed `docs/api/reports/*.api.md` baselines are generated
after the final build, not in this phase.

## Additional authored boundaries (not executed)

- CRUD's established `crud-engine` import is a forwarding facade to one engine
  constructor. Configuration, computed values, actions, HTML and DOM ownership
  now have private leaves. The owner forwards live capabilities through typed
  getters/setters; helpers are never cast to a synthetic `CrudEngine` instance.
  `buildState` still passes the original signals and resource signal. The old
  computed no-op `set` marker remains an implementation quirk, **not** a new
  writable-Signal contract. Changes to row/context types belong to #38's
  contract migration, separately from this #40 move.
- Resource's old import is likewise a facade. Types, key serialization, request
  orchestration, retry transport, mutation ownership, lifecycle and registration
  now have separate leaves. Registry state imports the engine **as a type only**;
  runtime initialization is acyclic. Disposal indexes registrations by the real
  owner, not by the helper scope. Signal replacement on revival and live request
  generations are forwarded rather than copied. No extra async delegate layer
  was added around the extracted async implementations.
- Expressions' low-level `evaluate` now returns unknown, and its public type
  guards accept unknown. Function guards prove callability, not any particular
  argument signature (`never[]` parameters). Arithmetic keeps native JS
  operators behind three documented internal `any` operands: BigInt, Symbol
  failures, ToPrimitive order and loose equality are not replaced by Number
  conversions. Async component callbacks also expose unknown context values.
- Consumer import authoring now selects real `require` entries even on Node
  without `require(esm)`. It omits only ESM-only entries from that runtime's CJS
  pass; a declared dual package's ESM-only dependency failure must be reported,
  not silently hidden. This is not proof that the advertised Node floor works.

Authored fixtures cover constructor/factory/directive identity, live CRUD state,
row sorting/event deduplication, local DOM/action ownership, Resource registration
identity/revived signals/reset generations, expression native coercion/getters/
short circuits, public unknown inference and consumer-target selection. None has
been run. Runtime/Core refactors, full export classification, positional callers,
whole-graph public-any cleanup and final declaration/size/behavioral evidence
remain open; neither the shared API debt nor the 28-card set is accepted.


## Runtime/Core and read-only integration — authored, not executed

### Compatible extraction candidates (#40)

- Runtime's public index forwards to one canonical `Zen` in `zen.ts`. Lifecycle,
  configuration, plugins, performance/flush, cloak and host capabilities are
  private leaves. Startup/stop/HMR receive that same live API, not a copied
  singleton or new engine. Public method replacement remains observable.
- Walker traversal, if chains, directive dispatch, telemetry and custom registry
  are separated; callbacks are passed explicitly to avoid facade recursion.
  Hydration has context/root/value leaves and retains its distinct raw-key and
  get-only-unwrapping semantics rather than silently adopting main-context rules.
- Loop syntax/context/key evaluation and virtual scrolling layout now have
  private leaves. Owner files are 299 (`for.ts`) and 350 (`virtual-repeat.ts`)
  source lines; this is **only a source count**, not a compiled-size result.
  DOM mutation order, template identity and parent/scroll fallback were retained
  in the extraction candidate. No production bundling/behavior evidence exists.
- Runtime Core's app/scope/walker/registry/hydration/directive owners were split.
  The private registry factory now constructs a typed heterogeneous owner table,
  preserving the original frozen table/reference identities without an
  `as unknown as RegistryOwner` bridge. Factory construction is compiler-checkable;
  it has **not yet been checked**. Public App namespace types remain specific.

### Separate contract/correctness candidates (#38/#55/#118/#120)

- Runtime contexts, hydration and directive operands are unknown boundaries.
  `registerCustomDirective(tag, { handler, attributeName? })` validates the
  canonical options; the legacy handler/attribute form warns `ZEN-DEPR-086` and
  keeps its historical default/falsy attribute handling. Stateful's production
  registration call is migrated. Handler identity is preserved, while cleanup
  now owns the **registration record**, including same-callback replacement.
  `listCustomDirectives()` returns a detached lowercase names inventory. This
  does not claim every registry has been proven request/App isolated.
- Parity assertion/divergence have canonical schema-validated option bags,
  arbitrary unknown operands, and legacy bridges `ZEN-DEPR-087/088`. Legacy
  argument-count dispatch and strict/throttled behavior remain separate from
  canonical validation. Native JSON.stringify/coercion failure behavior is not
  replaced by a decoder. Legacy assertion emits only its own bridge warning.
- `ReadonlySignal<T>` is a real read-only capability set. Previously omitting
  only `set` also advertised `update`; that mutation is now excluded. Computed
  supplies real `peek`, subscriber-count and consumer-release methods and no
  longer needs a cast to its advertised return type. Form field value/error/
  touched/dirty and array-items views are readonly; writes go through form
  setters/array operations. This corrects the earlier unresolved Form typing
  debt, but is a **source-contract change requiring review**, not a mechanical
  refactor. Optional nested/array generic parameters remain caller assertions,
  not runtime validation of remote payloads.
- Devtools panel/hook payloads expose unknown. Panel registration only requires
  a readable container; no writable Signal<unknown> is manufactured. Core
  inspection views are read-only and preserve weak-reference identity. Time
  travel deliberately writes dynamically using an actual callable setter and
  receiver (`Reflect.apply`), with readonly failures caught by existing
  restore/replay owners. Snapshot callers still own payload compatibility;
  there is no invented runtime type decoder or broadly writable public view.
- Reviewed established Runtime/Devtools API shapes have explicit public tags;
  private traversal/reset helpers retain internal tags and are not added to
  root facades. This is not whole-repository export classification approval.

### New authored fixtures (all unrun)

Runtime: `refactor-boundaries`, `walker-boundaries`, `hydration-boundaries`,
`options-bridges`, `list-layout-boundaries`, `public-context.test-d.ts`.
Core: `refactor-boundaries`. State: `computed-capabilities`,
`readonly-capabilities.test-d.ts`. Form: `readonly-fields` plus inference fixture
extension. Devtools: `unknown-boundaries` runtime/type fixtures. Devtools Core:
`signal-mutation`, `time-travel-boundaries`, `inspection-types.test-d.ts`.

These cover facade/singleton/method identities, HMR dispatch, plugin retry and
ownership, reactive DOM/if/list/memo/island teardown, hydration semantics,
canonical/legacy validation/warnings, registry token ownership, App scope and
injection, real computed read-only capabilities and time-travel receiver binding.
They are authoring targets, **not passing assertions**. No test/typecheck/build/
lint/audit/API report/CI was run, and no commit/push/issue mutation was made.

Remaining: whole published declaration graph cleanup, full export-level decisions
and positional inventory/callers (including method coverage), all remaining
28-card code-authoring debt, then the single final validation/fix phase and
card-by-card acceptance. Public-any zero, internal-any ≤100, ABI/size stability
and completeness of the 28-card scope are still unestablished. External owner,
store approvals/manual QA and major/API decisions remain blockers. **0 accepted,
0 closed**; the earlier historical pass is not current-tree evidence.

## Further shared-API integration — source/member graph and remaining dynamic views

This continuation is still code/test authoring. No inspection script, test,
compiler, build, lint, report generator or CI job was executed.

### Positional signatures: two explicitly different inventories (#55/#56)

The legacy source-export inventory now sees exported classes/constructors,
interfaces/call signatures, function-valued properties, object members, callable
aliases and exported class expressions. Members have qualified names; private
and protected members are not called public. An implementation behind overloads
is not another callable overload. An options parameter elsewhere does not excuse
another positional configuration value. Leases can bind exact parameter types
and source files; a changed signature or another owner is not excused by a bare
short method name. The inventory explicitly identifies its **source** scope.
It still includes exported implementation leaves and is not publication proof.

A separate `check:positional-config:published` candidate follows the actual built
TypeScript export/type graph: aliases, namespace exports, instance/static methods,
callbacks, generic container payloads, factory returns and concrete rest tuples.
It shares fail-closed declaration loading with the public-any/API report tools.
Missing/unresolved/ambiguous public declarations fail rather than count as zero.
Recursive namespace/type paths terminate or fail on uncontrolled type expansion.
The final built-library CI job is authored to run this after declaration build;
no CI has been triggered. Method/inheritance/alias/tuple/overload/failure fixtures
and matching ESLint member fixtures are authored, not executed.

Only five newly reviewed **data-operand protocols** were leased by qualified name
and exact parameter types (ColumnDef.render, ZenApi.start and three walker callback
types). These are not a blanket method exception. Remaining source/member/public
violations and coarse historical exemptions still require review/migration in the
code-authoring phase. There is no claimed clean positional inventory.

### Formal metadata corrections (#56)

Declaration/source metadata now distinguishes visibility from lifecycle and
merges overloads deliberately. A deprecated positional overload no longer labels
the supported canonical function deprecated. Conflicting visibility is retained;
an annotated facade does not silently promote internal declarations. Explicit
exports outrank star facades independent of statement order. Namespace exports
remain namespace bindings, not flattened root names. Shared metadata/source/
declaration fixtures were extended; no regenerated report or whole-repository
classification result is claimed.

### Compatible module moves, separately tracked (#40)

- DataTable's established `data-table` path and package root forward to the same
  factory. Private types/options/value/views/export/grid/window leaves share the
  original owner signals. No synthetic DataTable instance is cast into helper
  context. Main engine: **361 source lines**; all new leaves are below 400.
- Suspense's established facade forwards to one context factory, controller,
  directive and promise helper implementation. Context/controller/directive own
  their original callbacks, timers and state; types/schema are separate leaves.
  Owners are **168/205/197 source lines**, respectively. Nested context callbacks
  still capture live parent state, not a snapshot or new controller.

Those are source counts only. Neither compiled byte growth nor behavior/ABI
identity has been measured. The separate contract changes below must not be
presented as compatible extraction evidence.

### Separate type/configuration candidates (#38/#55/#120)

- DataTable cell/editor values and row keys expose unknown. Concrete object-row
  inference is retained, including interfaces without string index signatures;
  object-valued keys retain identity. Native dynamic path/coercion/comparison
  operations are explicit, not response decoders. `setColumnFilter(key, { value,
  operator })` is schema validated; legacy string/operator operands warn 089 and
  retain their default/disabled-filter path. The existing primary DOM consumer
  uses canonical options; the bridge has a dedicated regression fixture.
- Store's dynamic assembly no longer uses an any-typed store/context or broad
  action arguments. Its private heterogeneous registry retains only disposal
  capability, not a fabricated writable `Store<unknown>`. Typed assembly has one
  private assertion after getter/action installation; named generic lookups are
  still caller-declared, not payload validation. Native getter/thenable receiver
  and lookup order are retained. Strict in-place patch/reset writes reject failed
  assignments. Host/persistence/error-boundary metadata likewise no longer need
  broad any casts. This does not certify every legacy state shape or lifetime.
- Virtual-list/Suspense walker contexts are unknown; hidden heterogeneous signal
  maps expose readable capability without replacing actual signal objects.
- Suspense canonical context/tracking/timeout options now use shared schemas.
  Context creation with no arguments is canonical and silent; explicit
  `(undefined, callback)` remains the warned legacy default-parameter route.
  Internal controller/directive creation uses canonical options. Canonical
  nonnegative timeouts/consumed boundary capabilities are validated; legacy
  negative timeout no-op behavior remains separate. Promise identity and native
  timeout/tracking sequencing are not replaced with async facade wrappers.
- Schema/errors dependencies and lockfile workspace edges are authored where
  newly used. Dual-CJS/ESM-only dependency behavior at the advertised Node floor,
  final budgets and API/major approval remain explicitly unverified.

New runtime/type fixtures cover DataTable factory/live-signal identity, unknown
cell/key types, filter schemas/bridge warnings, CSV/window/grid teardown, native
editor paths, Store owner/receiver/thenable/symbol reset and type inference,
Suspense facade/canonical/legacy/nested tracking and unknown wrapper contexts.
All remain **unrun**.

Same 28-card scope, **0 accepted/closed**. This pass does not establish public-any
zero, internal-any ≤100, full export classification, clean method inventory,
release compatibility or test-only readiness of the complete set. Remaining
implementation and external/manual/approval blockers still precede final gates.

## Compiler / Testing / Security authoring continuation — 2026-10-18

These are **written candidates**, not accepted work or current-tree test evidence.

### Module moves (mechanical candidates, not the contract changes below)

- Compiler's former 1003-line owner is split into a renderer assembly owner,
  typed mutable per-compilation session, source walker, element analysis,
  runtime-fallback diagnostics, directive classification and value/model/for
  emitters. The established compiler facade re-exports the canonical factory and
  the same mutable public classification sets. Emitted strings, numbering,
  counters, failed-bind bookkeeping, diagnostics order and loop child delegation
  are deliberately retained. The parser owns its lazy import locally, not in a
  new process-global cache.
- Testing's former 855-line owner is split into reactivity/resource helpers,
  rendering/matchers, accessibility, reset, timers, fetch, router and directive
  owners. The reset hook Set remains in one module shared by all established
  import routes. Neither extra factories nor duplicate reset registries were
  introduced to satisfy size limits.
- Security's former 761-line owner is split into its original private tag/URL
  policies, HTML traversal, CSS, CSP, trusted marker and Trusted Types cache/sink.
  Its existing separately published security constants are not silently merged
  with the sanitizer's different policy. Default denylist, configured allowlist,
  source traversal, historical non-DOM fallback, policy cache and sanitization
  order are preserved by design, not proven by a run.

### Contract/lifecycle changes (not API-identical module moves)

| Surface | Authored canonical form | Retained bridge / boundary |
| --- | --- | --- |
| Compiler parity state | `Record<string, unknown>` | Source-contract change; callers narrow values. |
| `runParityTest` | `(suite, { runtimeRunner, compilerRunner })` | Positional runners warn 090. Shared schema checks callability only, not callback output/domain data. Original cases/state and runner invocation order are retained. |
| `runAllParityTests` | `({ runtimeRunner, compilerRunner })` | Two-runner bridge warns 091; internal aggregation does not call a warned legacy overload. |
| `setSafeInnerHTML` | `(element, { html, trusted })` | Old HTML/boolean operands warn 092; canonical strings/flags are validated. Explicit legacy undefined/default arity remains separate. |
| `render` | `({ template, state, attachToBody })` | Original template/state/options signature warns 093. A single canonical bag avoids confusing an old state object with a new options object. |
| `testDirective` | `(directive, { html, state })` | HTML/state bridge warns 094. Generic state remains caller-inferred, not domain-decoded. |
| Trusted Types outputs | `unknown` capability results | Native opaque values go directly to the DOM setter; no fabricated string type or stringification. Public capability types are explicitly exported/classified. |
| Node compiler parser | Private `Document \| Promise<Document>` | Removes the false async-as-sync return assertion and any-typed constructor/import caches. `jsdom@^24` is a declared optional peer, still available as a dev dependency. Browser-only users need not install it. |
| Numeric fake timers | Actual numeric replacement functions installed without Node-handle assertions | No `ref`/`unref`/`refresh`/timers-promises capability is promised. Failed second-slot installation rolls back the first patch; this is a lifecycle repair, not a pure move. |
| Optional `window.Zen.start` | Unknown lookup plus callable check/native receiver invocation | The two dynamic Zen lookups, getter order and actual method receiver remain intentional. Truthy non-callables still throw TypeError; the explicit error wording is not claimed API-identical. |

Warnings 090–094 are catalogued for proposed 2.0 removal. Compiler/Security join
Testing in the **proposed** major changeset. Schemas and errors/optional-peer
workspace lockfile edges are authored, not installed or consumer-validated.

Runtime/type fixtures cover full static renderer text, emitter counters and
fallbacks, facade/set/cache identity, loop delegation, model disposal hooks,
browser/Node/missing parsers, canonical/legacy warnings, original case/state and
runtime method receivers, reset hooks, numeric queue order/coercion/rollback,
resource/router/directive/fetch lifecycle, sanitizer policy behavior, historical
fallback limits, opaque sink outputs and CSP header order. A source-export
fixture follows these real facades and rejects leaked private owners. Existing
parity and strict-CSP consumers are migrated to canonical forms. **None ran.**

No tests/typecheck/build/lint/audit/report-generation/CI/commit/push/publication or
issue mutation was performed. No source-size observation establishes a bundle
budget, API parity, real-browser security enforcement or accepted card. Whole-
graph public-any cleanup/export classification/method inventory and remaining
28-card implementation are still not established. Existing major/scope/manual-
QA/external-owner blockers remain; **same 28 cards, 0 accepted/closed**.

## State / Form / native-write integration continuation — 2026-10-18

**Authored, unexecuted; not acceptance or an assertion of complete API cleanup.**

### Type and capability contracts

- State's scheduled/subscribed callback capability is now explicitly
  `EffectSubscriber = () => void`, rather than the untyped `Function` surface.
  The same callback objects remain in tracking contexts, subscriber Sets,
  priority WeakMaps, cleanup and scheduler calls. This tightens source contracts;
  it is not advertised as an API-identical module move.
- `isWritable(unknown)` now proves **only** `WritableCapability`, with an unknown
  setter domain (`set(value: never): unknown`). Previously it claimed a getter
  that it never checked, and suggested any value could be passed to a discovered
  setter. Detection still accepts setter-only objects; it does not validate a
  value domain. A known application-owned `Signal<T>` retains its original typed
  writes through intersection narrowing.
- Runtime/Core model, ref, persistence and hydration paths intentionally perform
  native writes of DOM/storage/server values. They invoke the observed setter
  with its actual receiver, not a fabricated writable `Signal<unknown>`. This
  does **not** make those values domain-validated. The legacy model's hidden map
  and target are unknown native capabilities, not an asserted full Map of Signals;
  setter-only local targets and array-shaped nested updates are retained.
  Explicit native-boundary TypeErrors need not retain the old engine's wording.
- Devtools flag lookup no longer casts the global object to any; precedence and
  existing opt-in/development behavior are unchanged by design.

### Form canonical configuration and legacy routes

| API | Canonical form | Bridge |
| --- | --- | --- |
| Field sync validation | `validateField(value, { rules, allValues })` | 095 |
| Field async validation | `validateFieldAsync(value, { rules, allValues, signal })` | 096 |
| Form async validation | `validateFormAsync({ values, rules, signal })` | 097 |
| Lifecycle validation | `validateWithLifecycle(values, { rules, lifecycle, async })` | 098 |
| FormStore item movement | `form.moveItem(field, { from, to })` | 099 |
| FormStore field addition | `form.addField({ name, initial, rules })` | 100 |

All old signatures remain deprecated bridges, with once-only registered warning
codes and proposed 2.0 removal. Original object-valued initials cannot be
mistaken for options because canonical `addField` uses one bag. A field named
`values` or `rules` cannot be mistaken for async form configuration because
canonical form validation uses one argument and the old route uses two/three.

Canonical schemas check configuration/callability/consumed abort capability.
Cross-field values, lifecycle receiver, abort object and initial-value payloads
keep identity. Callback signatures and arbitrary payload fields remain
caller-declared, not decoded. Canonical rule maps are validated snapshots.
Undefined/function/object initial values remain valid payloads; the schema's
undefined default does not clone actual initial values. Canonical indices are
nonnegative finite integers; positional fractional/undefined native paths are
not routed through that stricter schema.

Private evaluators retain rule precedence, serial async order, abort checks,
first-invalid return and lifecycle callback order. Internal FormStore/advanced/
reset/dynamic-field callers use canonical APIs, avoiding incidental bridge
warnings. Async wrappers reject configuration errors and return evaluator
promises directly rather than adding an async forwarding layer. The wrapper
functions are not themselves the old AsyncFunction objects; exotic reflection,
stack text and microtask equivalence are not certified.

### Moves and classification, separately

- State registry record types have a private implementation leaf, while the
  registry maps, WeakRefs, IDs, listener arrays and installed hooks retain one
  existing owner. Established facades retain their values. Legacy registry
  records/APIs keep independent deprecated/public metadata; the live
  heterogeneous view is not deprecated by its neighbor's comment.
- Form's validation evaluators/configuration, dynamic-state construction and
  touched/field-summary helpers are separate from its owner. No helper asserts a
  fabricated FormStore instance. Store owner is 392 source lines; State registry
  owner was 356 before subsequent doc-only tags. These are observations, not a
  size/behavior/budget gate.
- Established Form user-facing exports and documented State public/legacy
  functions have explicit release tags. Existing State root internal hooks,
  member classification and any future internal-entry singleton/consumer design
  are **not** silently relabeled or removed. This pass does not establish a
  root-public-only graph or complete callback/method protocol inventory.
- Form field/array views already used real `ReadonlySignal` in the earlier
  candidate; this pass does not claim to have newly implemented that rewrite.
  Computed initialization/dependency/lifetime behavior and full Form ownership
  still require implementation review before declaring the phase complete.

Runtime/type fixtures cover setter-only guard behavior and negative writes,
zero-argument subscriber typing, registry facade/weak identity, native setter/
map receivers, model/ref/hydration cleanup and payloads, canonical configuration,
legacy warnings/defaults, async rejection/abort order, lifecycle receiver/order,
field names/options ambiguity, unknown initial values, class method overloads,
construction validation order and touched no-op identity. Actual source-facade
metadata fixtures cover new exports without promoting the internal priority
hook. **No fixture ran.**

Same 28 cards, **0 accepted/closed**. No tests, typecheck, build, lint, audit,
report generation, CI, commit, push, publication or issue mutation. Existing
consumer/CJS/size/security/manual QA/owner approvals and remaining implementation
remain open; this is not a test-only-readiness declaration.

Additional Form source-contract tightening: `AdvancedFormApi<T>.setFieldValue`
correlates known string keys with `T[K]`, rather than accepting any unknown value
for an already typed field. Dynamic `Record<string, unknown>` forms still accept
dynamic names/unknown values; runtime JavaScript evaluation is unchanged and is
not a domain decoder. Strongly typed callers with arbitrary string names or wrong
field values may need migration; no universal deprecated type overload widens
those checks back out. Existing `Record` generic constraints/interface-shaped
initial-data ergonomics remain a separate review item, not a claimed fix.

## 2026-10-18 — State lifetime and captured Form ownership candidate

**Written, not executed or accepted.** This continuation implements the previously
pending lifecycle work; earlier entries describing it as untouched are historical.

### Behavioral/source changes, not compatible extraction

1. State restores nested active-effect/cleanup context and ambient owner even on
   error; effect children from the preceding execution are disposed before rerun.
   Explicit null owners detach, undefined owners inherit, dead parents do not
   acquire running children, and urgent numeric priority zero is not discarded.
2. Root entry/exit uses `finally`; late disposal preserves the current caller.
   Owner teardown is untracked and best-effort across child/callback failures.
   General `onCleanup` stays owner-bound; it was not silently converted to a
   per-run callback queue. Watch callback cleanup remains its separate protocol.
3. Computed uses an empty/ready typed state, creates its actual signal after one
   tracked first evaluation, restores outer tracking and isolates native observer
   reads. Initial thrown values are rethrown without global-boundary swallowing;
   partial dependencies are removed and a live value can retry. Circular first
   initialization is rejected. Disposal releases its callback and subscriptions;
   initialized reads are snapshots, unread disposed reads throw. No resurrection,
   placeholder observer event or exact previous creation timing is promised.
4. Watch teardown follows its parent and fixes the immediate-once startup race.
   Async state owns its tracker and signals, aborts on parent disposal, suppresses
   late writes and starts deferred reactive tracking on refresh. Current AbortError
   clears loading; observer-driven re-entry is checked before subsequent writes.
5. Advanced/Wizard APIs gain explicit `dispose()`. Field/nested/array computeds
   created later re-enter their real form owner. Native exposed signals are not
   revoked; caller-declared nested/array payloads are still not decoded.
6. Advanced validation uses per-field/run/value/lifetime leases. Only current runs
   write errors/flags; explicit validation/submit errors keep promise rejection,
   background failures are observed, and reset/disposal invalidates stale work.
   Autosave owns its timer and ignores late failures. User promises/side effects
   are not undone or guaranteed to abort.
7. Wizard navigation checks current step/value/run, honors step validation, resets
   step/completion with the form and cannot advance after disposal. Store async
   validation allows independent concurrent fields; whole-form/field busy state,
   cancellation, stale-result merge and submission guards have an actual owner.
   Store teardown releases timers/subscribers even if a native observer fails.
8. Advanced array movement distinguishes an actual undefined entry from no removed
   entry; Store movement validates the original array before spreading. These are
   separate correctness fixes, not an assertion of legacy byte-for-byte behavior.

### Private decomposition and authored evidence

`form-scope`, `form-autosave`, `form-advanced-validation`, and
`form-store-validation` are private real-owner/capability helpers; none asserts a
fabricated full FormStore. Their extraction accompanies the changes above and is
**not** classified as a mechanical equivalent move. The Store owner is now below
its earlier 392-line observation; final file/bundle budgets have not been gated.
State/root still use the existing context owner rather than introducing another
independently bundled internal entry.

New State/Form lifecycle fixtures cover nested tracking/ownership, foreign-root
view creation, teardown errors, lazy single computation, observer isolation,
initial error/undefined/circular/retry, terminal disposal, watch once/parent cleanup,
async abort/deferred refresh, autosave cancellation, stale validation and submit,
wizard reset/step callbacks, concurrent Store fields/whole-form merge and NaN.
Type fixtures retain concrete nested/array inference and assert disposal; source
metadata fixtures keep private leases/coordinators out of root exports.

Source inspection explicitly confirmed `WritableCapability` is root-exported and
`extractPackageExports` returns a Map (the fixture `.get/.has` calls are intentional).
This is source evidence only, not execution of those fixtures.

Remaining API work includes complete callback/member/export inventory,
State/internal singleton/nominal packaging design, broader Form generic/factory
normalization and any other unfinished same-28-card implementation. Async callback
resource creation after `await`, in-place payload mutation, external raw writes and
real request/runtime matrices are not certified by these guards. **No tests,
typecheck, build, lint, audit, report generation, CI, commit, push, publication or
issue mutation; same 28 cards, 0 accepted/closed. Not test-only-ready.**

Self-disposal is also guarded: dependencies read by the still-running synchronous
body after its scope is disposed are immediately unlinked, and a rerun does not
execute its body if prior child teardown disposed the parent. Both cases have
additional authored/unrun State fixtures; no gate or acceptance changed.

## 2026-10-18 — Form factory/value contracts and callable inventory continuation

### Contract changes, separately from owner/facade moves

- `form-factory` and `form-reactive` are real implementation leaves behind the
  existing `form`/root facades. Candidate facade identities are checked by authored
  fixtures; changing factory dispatch/types is not an API-identical extraction.
- Reactive forms preserve supplied record identity and async submit controls, add
  captured ownership/disposal, and no longer cast an absent `{}` to `T`. Optional
  initial options return a `T | Record<string, unknown>` data container; concrete
  supplied data retains its exact type. This small API is not advertised as an
  implementation of the advanced validation/autosave contract.
- Wizard factory typing requires a real initial object to promise a concrete T.
  No-initial wizards/default advanced forms are dynamic records. Empty step arrays
  now produce the promised Wizard API, not an Advanced-only object. Missing-initial
  configuration has schema-checked records/callability/step/autoSave capabilities;
  callback outputs, item types and arbitrary payloads remain caller-declared.
- Static non-colliding field maps still return FormStore. The dynamic field-map
  overload returns the actual legacy dispatch union rather than guaranteeing a
  Store despite reserved runtime names. Explicit `new FormStore(fields)` is the
  unambiguous path; all schema adapter constructors use it, including reserved-name
  fields. Existing legacy routing keys are retained; no new mode API was added.
- `ReactiveFormApi`, `FormFieldDefinition`, `FormFieldDefinitions` have explicit
  public exports. Private dispatch/configuration/equality helpers stay private.
- Advanced dirty comparison supports opaque/cyclic/non-JSON payloads without
  serialization. Plain enumerable data is structural, native/class/accessor data
  identity-based, and failures or a 10,000-pair budget conservatively differ.
  This deliberately changes JSON equality (including function/undefined/NaN/-0/
  symbol/Date/Map cases); it is not a decoder or global deep-mutation protocol.
- Array views verify array shape, preserve real undefined entries in swap/move and
  can clear dirty on restored contents. Explicit field errors invalidate older
  field decisions. Field/array/touch bookkeeping checks observer-driven lifetime/
  value replacement before continuing. This is not full transactional observer
  rollback or proof against arbitrary external raw-signal mutation.
- Watch's erased private callback uses `never[] → unknown` plus native invocation,
  not `WatchCallback<any, any>`. Concrete overload inference remains the public
  contract; outputs are ignored. `EffectFn` describes the real void subscriber,
  not a callable cleanup-return promise. Documented State types and all live watch
  overloads gain public metadata; legacy batch/error aliases retain deprecation.
  Root integration/internal exposure remains unresolved, not silently promoted.

### Positional/callback inventory code (no gate run)

Source inventory and the matching ESLint rule expand direct named/optional/
readonly/nested rest tuples and retain each union branch. The declaration checker
also resolves tuple aliases and variadic tuple composition. A canonical short
branch cannot hide a supported positional long branch. Cartesian expansion fails
closed above 256 variants instead of returning a false clean inventory; nested
synthetic argument labels are rebased. Source/lint syntax alone cannot resolve
arbitrary imported aliases, generic rests or arbitrary variadic callbacks; the
published checker and explicit protocol review remain necessary.

Six narrowly reviewed **data-operand callback** leases were added, not a blanket
package/function exemption: State WatchCallback (new/old/cleanup), SignalObserver
onChange (signal/old/new), Form sync/async rule operands (value/cross-field/rule
argument/abort), and field-change/error lifecycle operands. Qualified owner and
exact parameter text bind each lease. Existing invocation protocols are retained;
no settings were hidden in extra positional arguments. These additions do not
complete the whole-workspace callback/member inventory or prove every hook runs.

Authored/unrun evidence: factory runtime/type/identity/default/empty-step/schema/
reserved-name/lifetime cases; opaque dirty/array/manual-error cases; State callback
receiver/ordered tuple/negative types; real source metadata; source/ESLint/published
rest tuple/union/nesting/budget/lease drift cases. Existing scripts/tests were only
read and edited; no TypeScript/ESLint/test/build/report tool was loaded or executed.

**Same 28 cards; 0 accepted/closed.** Remaining generic/interface design, callback/
member/export graph work, State internal-entry/nominal singleton packaging, other
card implementation and external owner/manual QA remain open. No tests/typecheck/
build/lint/audit/report generation/CI/commit/push/publication/issue mutation. No
all-28 or test-only-readiness declaration.

### Additional deep-watch contract correction in this continuation

Source review found a second payload lie: deep watch cloned/unwrapped fields, then
passed that graph to a callback typed as the original T (losing nested Signal and
class capabilities). Deep watch now captures a private bounded observation graph
for change detection and passes actual source values to callbacks. Previous
values preserve raw source identity; in-place nested changes may have identical
next/previous objects, not a fabricated historical T clone. Structural readable
roots require their declared get(), not an undocumented brand/setter. Private
graphs handle cycles/non-JSON/symbol data and nested readable tracking; native/
class identity is retained and arbitrary native collection mutation is not
certified. Getter/prior-cleanup disposal stops later traversal/callbacks. Graph
helpers stay out of root exports. Runtime/type/metadata and stop/cleanup fixtures
are authored, **not executed**. No gate, push or acceptance changed.

### 2026-10-18 — State host boundary and request ownership continuation

**Authored only; no tests/typecheck/build/lint/audit/reports/CI/push.** Same 28 cards,
0 accepted/closed. This continuation addresses shared #38/#55/#56/#57/#174 debts;
it is not all-28 readiness and does not approve a release or root removals.

- Added `@zenith/state/internal`, explicit internal entry metadata, both JS/type
  conditions, the authoritative subpath table, self-source build mapping and
  Vitest/type-test/ESLint/dependency-cruiser mappings. The facade deliberately
  re-exports from the external self-package `@zenith/state`; separate entry builds
  must never inline relative State implementations or copied nominal declarations.
  SSR's provider/type imports moved to this entry. Root names remain compatibility
  bridges; host context/tracking/reset/registration hooks are not promoted public.
- Ownership now lives in the selected EffectContext, not a second global owner
  variable. Queued effects and owner disposers retain their creation context via a
  shared weak owner-disposer map and synchronous, finally-restored State override.
  Native hosts may bind typed argument/result-preserving callbacks. Node SSR uses
  native `AsyncLocalStorage.snapshot()` **per registration**, not one snapshot of
  the first App/route to access a request context. The declared Node floor is not
  changed; State remains Node/DOM-free.
- Lazy computed initialization retains the producer context; subscription of its
  returned value remains in the reader context. Async refresh/abort and watch stop/
  late cleanup registration retain their origin too. Binding failure/dead-parent
  reentry must not leave half-attached owners. These are contract/behavior changes,
  not #40-compatible file moves. A host binder is synchronous and transparent;
  arbitrary delayed/eager binder implementations are not a supported async adapter.
- Node SSR shares its native DOM store, global-getter installation marker and weak
  App claim sets across render formats. Each render always enters native route
  isolation, defaults to `/` when omitted, creates an ambient request owner before
  prepass/factory work, binds abort dispatch, and disposes the owner before other
  request resources. A disposed tombstone rejects default-owned late continuations.
  Explicit detach/null/root escapes and arbitrary user Promise side effects are
  not revoked. Request context is retained by caller-held native-bound functions.

Authored evidence: source/type/metadata/subpath mapping cases; provider/fallback/
restoration/binding-failure tests; 100 interleaved owner scopes; 100 **live** native
DOM/route/scheduler scopes; actual 100-render prepass/async-factory ownership cases;
default route, factory failure, late cancelled continuation and paused-stream cases;
built State root/internal identity and declaration-reference fixtures; built mixed
Node SSR-format context/App-claim consumers. All are unexecuted/uncompiled. Teardown
observations are collected and asserted outside swallowed best-effort cleanups.

Still open: root-public-only/legacy removal approval, SSR root/internal export
cleanup, full callback/member/public-any inventory, existing cross-format root
Signal/Computed constructor/declaration identity, certification of the candidate
shared channels described below, remaining card implementations and external
owner/manual QA.
The self facade prevents an **additional** internal owner per format, not every
pre-existing dual-package hazard. Edge explicit-context parity is not certified by
the Node-native changes or fixtures. No acceptance checkbox is changed.

### 2026-10-18 — Shared State channels, readable inspection and scoped diagnostics

**Authored candidate, no acceptance:** a second private State runtime holder now
shares observer leases, legacy notification dispatch, effect priority metadata,
effect-error registrations and weak registry ownership across formats. It shares
**data**, not Signal/Computed constructors. Context selection/owner restoration
remains in the existing State context holder and narrow self-package facade.

- Observer installations use linked identity tokens, including out-of-order
  removal, repeated same-object installs and temporary null overrides. Disposed
  records release observer references; retained live installs still need cleanup.
- Error registrations use identity tokens but preserve replacement/clear behavior,
  not restoration. Default priority is context-local; metadata is shared.
- Legacy registry records/timeline/listeners are context-owned. IDs never rewind;
  automatic actual-Signal writes fan out only to registered live origin views.
  Callback capture is synchronous/native-context bound and untracked. Snapshot,
  identity and generation checks prevent old dispatch/reset work from deleting or
  publishing new registrations. Timeline remains bounded to 1000 entries.
- Optional host `registerDisposal` closes diagnostic lifetime; late registration
  returns the closed sentinel rather than reopening retired request records.
  Node SSR establishes DOM context/lifetime before route Signal construction and
  retires this registry before releasing App/DOM resources. Explicit devtools
  false overrides development defaults.
- Observer naming now receives **ReadonlySignal<T>**, because structurally readable
  legacy inspections never promised writable class identity. Native create/change/
  dispose events retain their actual Signal<T> capability.
- Modern Core's `UntypedSignal<T = unknown>` is likewise readable: get, optional
  peek/count, no broad setter. Public register/name/change keep explicit generic
  arguments while checking real readable values. No fabricated identity, decoder,
  setter or no-getter-side-effect guarantee is introduced.
- Core inspection/getter/event work is untracked; pending/generation guards reject
  recursive or stale captures, including stale post-create name publication.
  Listener token cleanup cannot remove a later identical callback; resets drop
  captured callback references. Hook callbacks use native invocation without a
  false wider callable cast, and additions/removals obey snapshot dispatch.
- Live Core install tokens prevent premature hook unpublication and preserve an
  external replacement. Modern Core registry/config remain **module-local/global
  configuration respectively**; independent install config/restoration and duplicate
  Core-module identity are not promised.
- A host global-observation policy is set before Node route/prepass/factory work.
  State global notifications and modern Core capture/install honor it, including
  before a Document exists. SSR cannot change an outside Core config. Legacy
  inspection stays locally available until request retirement. The internal facade
  adds `isGlobalObservationEnabled`; it does not expose mutable runtime holders.

The existing Core recordStateChange positional lease was **narrowed**, not expanded:
readable identity plus old/new event operands must match exact parameter types.
These are behavior/type-contract migrations, **not #40 API-identical refactor
proof**. Root-internal bridges remain until approved removal. New internal-entry
consumers (SSR/Core) require the proposed State release; currently published older
State compatibility/peer floors are not certified. The approved release plan must
reconcile peer ranges before publication; no release approval is implied.

Authored evidence: both built State load orders (observer before second format,
identity/events/naming/disposal/legacy/ABA/errors/priorities/real scheduler/Core
publication); readonly observer and readable Core generic negatives; Core getter/
listener/reset/hook reentry; 100 actual SSR registry/privacy/priority renders,
foreign-request origin callbacks, stream retirement and outside-Core/prepass
privacy; actual tsc packaged .mts/.cts root/internal consumers with no paths or
source fallback. The latter proves **within-format** declarations only, not mixed
constructor identity. All fixtures remain **unrun/uncompiled**.

Open: full root-public-only separation, constructor/mixed declaration identity,
modern Core duplicate-module config/registry hazard, entire public-any/member/
callback inventory, Edge parity and remaining card/external acceptance. Still
same 28 cards; **0 accepted, 0 closed**. No tests/typecheck/build/lint/audit/reports/
CI/commit/push/publication or issue mutation were performed in this continuation.

Follow-through source review also found remaining Core global subscriptions,
panels and time-travel paths. They now honor the same Node request policy; explicit
internal process reset remains intentionally process-wide. Outside panel cleanup
uses unique tokens, not equality of App/cache/store values, and releases obsolete
payload references. Disposal drops both Core Signal identity mappings before
allowing later real raw-Signal inspection with a fresh ID. Incompatible hook
installation no longer applies proposed capture configuration first.

Snapshot/restore/replay are now untracked and epoch-guarded. A **concrete Snapshot
decoder** replaces both unchecked entry and emitted-domain assertions. Legacy
omitted timelineLength normalizes to 0; provided metadata/name types are checked,
extra input fields are not re-emitted as if validated. This does **not** validate
arbitrary Signal<T> payload compatibility: the explicit reflective write boundary
remains caller-owned and rejects unsupported setters. Native setter resolution is
separated from invocation so a getter/reset cannot force an old-epoch write.
Overlapping replay uses distinct operation tokens; reset clears only active tokens
and old sleeping work cannot resume writes or suppress new-epoch capture. Existing
pacing is preserved. Decoder, native getter/clone invalidation, concurrent replay,
reset, panel ABA and real SSR hook/panel/time-travel privacy fixtures are **unrun**.
Cancellation fixture teardown no longer waits for an unentered factory; stream and
100-request fixtures inspect retained **native-bound scopes**, not just outside
module views, before/after retirement. No acceptance or gate state changed.

### 2026-10-18 — Graph, browser-hook ownership and compatibility panel continuation

**Source/test authoring only. Same28; 0 accepted / 0 closed.** No interim execution.
The prior Signal-registry boundary did not cover global graph recording, browser
hook closures or the old panel API. This pass extends the native host policy to
those paths rather than claiming the entire diagnostic surface was already safe.

| Surface | Canonical call | Deprecated bridge |
| --- | --- | --- |
| RuntimeGraph / browser hook signal node | `addSignal(id, { name, value })` | ZEN-DEPR-101 |
| RuntimeGraph / browser hook directive node | `addDirective(id, { directiveType, elementSelector, expression })` | ZEN-DEPR-102 |
| Compatibility panel event | `recordPanelStateChange(id, { oldValue, newValue, signalName })` | ZEN-DEPR-103 |
| Browser static-for metadata | `addStaticFor(id, { expr, itemCount })` | ZEN-DEPR-104 |
| Browser resource-destroy metadata | `recordResourceDestroy(name, { url, stack })` | ZEN-DEPR-105 |

The old raw event shape is selected by **arity**, not by guessing properties of an
unknown oldValue. Canonical event options are concretely shape-checked; values stay
unknown and are not decoded into application types. The obsolete name-only panel
positional waiver was removed. Runtime negotiates graph options only for a hook
advertising graphProtocolVersion **2**; unmarked foreign hooks still receive their
old positional protocol. The public hook interface's marker/options additions are
part of this proposed major contract, not proof of old declaration compatibility.

- The exported realm graph is hidden/mutation-muted inside native SSR scopes and
  when explicitly disabled. Explicit `new RuntimeGraph()` stays caller-owned,
  usable in SSR; it does not silently acquire automatic request lifetime.
- Graph snapshots copy node/edge metadata and dependency arrays, not arbitrary
  opaque values. Type-changing node-ID replacement removes the previous kind's
  edges/data. Length-framed edge keys avoid delimiter collisions. Existing 500
  nodes-per-kind bound remains; input-getter reset cannot append an old capture.
- Unknown legacy graph globals are no longer asserted to be typed hooks. Discovery
  and invocation use object/function checks, actual receivers and ignored results,
  with untracked capture, reentry/reset guards and best-effort failure containment.
- Runtime walker telemetry similarly drops its fabricated WalkerGraph cast and
  guards **discovery getters**, not just later calls. A private realm data holder
  shares weak element IDs, monotonic sequence and per-element in-flight guards
  across duplicate/HMR modules; it does not unify Runtime/State constructors.
- The browser hook now owns a concrete installation, subscriptions and exact DOM
  event registrations. Cleanup preserves foreign hooks and foreign cleanup arrays;
  retained old hook objects cannot read/mutate a new installation. Visibility uses
  the captured Document. Pagehide clears owned subscribers/data; native Vite HMR
  disposal closes the captured installation, not whichever installation is newer.
  Failed lifecycle setup rolls back owned publication/resources.
- Hook static/resource/expression/store metadata is bounded to 1000 entries. The
  compatibility panel stores captured metadata, not unused strong readable refs;
  signal/effect records are bounded to 1000, its existing timeline to 500. Effect
  dependency arrays and outward metadata are copied; disposed effects cannot be
  reactivated by a later marker. This retention policy is an intentional change.
- Panel capture/listeners are untracked. Per-registration nullable callbacks and
  snapshot/token/epoch dispatch handle ABA, disabled subscriptions, additions,
  removals, reset and bounded recursive notifications. Native SSR cannot subscribe,
  inspect, enable/disable or publish this outside panel API. Explicit global false
  suppresses capture without inspecting submitted readers.
- Explicit **process reset** now clears the realm graph, panel data/callbacks and
  browser-hook owned stores/subscribers. It is deliberately not a request API.
  A misleading pure annotation on Core's reset registration was removed. Size /
  tree-shaking compatibility is not certified by this source correction.
- Core installation/policy probes now run untracked; SSR returns before reading
  options. Disposers release observer tokens before best-effort global cleanup,
  including nonconfigurable-but-writable publication slots and hostile accessors.
- Graph and Core type/entry release tags were made explicit without publishing
  private policies/resetters/listener records/telemetry state. Existing internal
  root bridges, including Core's options helper, still need public-only migration.
  Devtools' direct Errors import is declared in manifest/lock; catalog 101–105
  has a proposed Errors minor change, not an authorized release.

Authored fixtures cover graph identity/bounds/copying/kind replacement/delimiter
keys/getter reset/native receiver/reentry/fallback, graph and hook options types,
actual browser ownership/pagehide/visibility/rollback/external replacement, panel
reader/listener/reset/ABA/bounds/effect metadata/arity/flag behavior, walker native
and foreign protocols/throwing getters/nontracking/reentry/duplicate modules, source
export/overload metadata and **100 real SSR prepass + factory scopes**. Prepass
execution and rendered output are asserted outside swallowed component error
handlers. Deferred owner/stream fixtures reject premature completion rather than
hanging behind an unentered factory.

Every new fixture is **unrun/uncompiled**. Still open: root public-only export
migration, State mixed constructor/declaration identity, duplicate modern Core
registry/config identity, approved new State peer floors, actual built consumer /
size/declaration/security gates, Edge parity, remaining same28 implementation and
external owner/store/manual accessibility approval. No test/typecheck/build/lint/
audit/generated report/CI/commit/push/publication or issue mutation was performed.

Final-phase authoring also adds `scripts/test/devtools-packaged-consumers.test.mjs`:
an actual spawned Node **ESM** Core/legacy graph-identity + muted-scope consumer and
real tsc package-options/readonly/nominal graph facade consumer, no source paths or
missing-dist skip. These remain unexecuted. They intentionally do not certify the
legacy CJS → ESM-only dependency path, Node-version matrix or mixed State identity.
