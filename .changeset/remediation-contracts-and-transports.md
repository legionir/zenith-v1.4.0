---
'@zenith/runtime-core': major
'@zenith/expressions': minor
'@zenith/realtime': minor
'@zenith/mock': minor
'@zenith/analytics': minor
'@zenith/testing-e2e': minor
'@zenith/eslint-plugin': minor
'@zenith/runtime': major
'@zenith/http': patch
'@zenith/resource': major
'@zenith/data': patch
'@zenith/errors': major
'@zenith/logger': minor
'@zenith/shared': minor
'@zenith/store': major
'@zenith/permission': patch
'@zenith/components': patch
'@zenith/compiler': patch
'@zenith/ssr': minor
'@zenith/adapter-edge': minor
'@zenith/adapter-node': minor
'@zenith/a11y': minor
'@zenith/ui': minor
'@zenith/head': patch
'@zenith/router': minor
'@zenith/security': minor
'@zenith/cli': minor
'@zenith/vite-plugin': patch
---

Code-first remediation: introduce explicit App reference registries with
registration-bound cleanup, shared lazy expression contexts and unknown-valued
compiled expressions. Narrow URL/list expression consumers before use. Clean
partial mounts/failed initial plugins and continue teardown after a cleanup error.

Add real WS/SSE transports, scoped realtime bindings/plugin, bounded queues and
consent-first analytics with isolated providers. Keep legacy transport/raw-send
facades; adapt the old analytics handler/listeners/timers through the canonical
consent/DNT engine, owned by the default App. Legacy configureAnalytics now needs
explicit consent (second options argument or setAnalyticsConsent); installing a
handler alone no longer grants consent. This runtime major proposal requires
release-owner approval.

Add test-only Playwright HTML/state/plugin mounting with cancellation, real App
readiness, signal access, console/axe diagnostics and explicit Node/browser entries.
Bootstrap the shared ESLint options-object rule. Move private extensions to tools
and add deterministic legal-bearing ZIP/VSIX packaging and declaration API gates.

This changeset records intended changes, not acceptance evidence. Tests, reports,
size/target/packaging/security gates and release review remain pending. The fixed
group must be versioned/reviewed by the release owner; no version command or public
publication has been performed. Existing unknown-expression consumers must narrow
results rather than reintroducing casts to any.

Continuation: CLI stdout/data now uses an explicit writer instead of diagnostic
console calls. Compiler/Vite generated code receives the logger explicitly, and
VS Code uses an owned output channel. Errors has a dependency-inverted transport
shared across root/subpath and ESM/CJS bundles; runtime App initialization installs
the default logger bridge. Standalone errors consumers must install an explicit
host policy (`installDiagnosticLogger` or `setErrorLogger`). This is an intentional
compatibility change requiring release-owner review, not a validated release.

Add scoped lower-layer registry adapters for stores/resources/permissions and
components/server components, with App.run synchronous ownership and request-local
SSR providers. Stale same-value cleanup cannot remove a replacement registration.
Newly created stores/resources are lifecycle-owned; borrowed registrations remain
reference-only. Async browser code must explicitly re-enter App.run after awaits.


Core/Store/Resource contract proposal (release-owner approval still required):
Core extension values and plugin defaults use unknown; processChildren returns
an owned subtree Cleanup. Hydration cleanup releases the internally-created App
and signals. Store getters are declared as Computed<T>, matching their existing
runtime objects; action-context getters remain unwrapped. Lookup generics and
persistence migration require explicit narrowing rather than public any.
Resource request bodies accept unknown at the JSON boundary; setData must return
T|null, and optimistic patches accept records. Removing/resetting a registry now
disposes registered Resource lifetimes. Explicit Resource.reset() remains the
legacy revival API and gives a previously-disposed instance a fresh Signal;
consumers must re-subscribe after revival. The uniform Resource BindContext is
the preferred binder; positional overloads remain deprecated compatibility.

The module splits for Core, Store and CLI are NOT being represented as an
API-identical #40 acceptance: these contract/ownership changes also alter the
candidate. Review a separately-generated final API report and migration guide.
No release, acceptance gate or API snapshot comparison has run on this tree.

Continue #109 with real project lifecycle runners, one JSON envelope and explicit
exit codes, physical-graph doctor, conservative binding-aware upgrade planning and
backup/rollback, and runnable scaffold tests. Publish a side-effect-free CLI
program subpath; keep the bin separate. No commands/checks have been validated.

Add reference-counted menu acquisitions and stop Resource child walks when their
owner closes reentrantly. Resource DOM registration tokens no longer release one
another, and disposal continues all cleanup paths before propagating errors.

Add canonical Node static/server signatures with compatibility bridges, static
Brotli/gzip/ETag negotiation, race-safe server drain and request observer hooks.
The Node adapter remains partial: this is not a claim of streaming/trustProxy or
complete option/spec parity.

Continue the new Node adapter's strict factory/outlet contract without removing
legacy facade support from @zenith/ssr. Native Node ALS replaces the unsafe Node 18
fallback; async factory Apps have cancellation/late-result ownership and exclusive
mount guards. Preserve trusted document shells and nonce-bearing static scripts
and styles; stream via native pipeline with HTML Brotli/gzip and cache/proxy loader
contexts. Share request state snapshots with the explicit-document Edge entry.
These are authored candidates, not executed proof of Node/Edge parity or completed
SSR hydration. Generated SSR scaffolds now use a fresh server App, transferred
client counter state, the outlet marker and disposable client HMR ownership.

Continue UI owner closure and reentrant acquisition cleanup: tokenized modal and
portal leases, queued geometry cancellation, tooltip IDREF/timer ownership,
nested/validated accordion state, lazy panel late cleanup, and delegated combobox
rows with close/debounce/request cancellation. Add logical RTL floating alignment
and hover/focus triggers. Focus traps no longer report a stale activation failure
when initial focus synchronously disposes/deactivates their owner. UI plugin
bindings created during uninstall are disposed instead of retained. Full UI
reactive options, directive schemas, calendar/form parity and final browser QA
remain separate uncompleted criteria; no test execution is claimed here.

Continue Date Picker calendar/form/range contract: Gregorian/Jalali parsing with UTC
civil arithmetic, locale/first-day/format, readonly/required/exclusions, ordered
ranges and canonical events alongside the legacy complete change event. Prefer
native form-associated ElementInternals with a single owned fallback input; preserve
reset, fieldset and lifecycle ownership. Add schema-backed reactive createDatePicker
and per-processing acquisition leases. Add opt-in DirectiveDefinition.tag matching
through an App-owned invalidated tag index so UI custom tags use the same binding
and cleanup path without duplicate attributes. This additive Core API is not being
represented as an API-identical refactor. Metadata/browser fixtures are authored;
API reports, browser/form/axe behavior and size gates remain unexecuted.

Track tooltip hover/focus/surface intent independently, preserve pending deadlines,
and suppress dismissed-session reopening after Escape or outside closure. Defer
popover arrow mutations until after reentrant geometry checks. Keep Date Picker
month announcements in a stable connected live region, observe inherited language/
direction and parse the digits generated by the configured locale. Add authored,
unrun interaction, form-reset, locale and geometry regressions/browser fixtures.

Add strict, shared-schema UI configuration resolvers and readable collection options
for tabs/accordion/combobox. Keep node identity through lazy mode updates and restore
failed setup/parked content; expose silent setValue operations. Add tracked,
App-owned two-way directive values for dialog/popover/tabs/accordion/combobox,
text-only tooltip expressions, dialog portal ownership and complete combobox
projection/filter/async attributes. Stop obsolete combobox sources on reconfiguration
and reject stale results; add IME/Home/End/initial-arrow handling and input restoration.
Register UI directive metadata and author additional unit/type/browser fixtures.
These API additions/corrections remain unvalidated; surface reactivity, common motion,
public API parity and size/accessibility gates are not marked complete.

Make generic portals participate in logical floating ancestry and restore orphaned
body-level content when its original source subtree or destination is removed.
Respect external reparenting; keep restoration cache ownership through reconnects
and roll back failed moves. Add unrun portal/modal/App lifecycle regressions.

Add readable surface configurations and owned live focus/modal/scroll/portal/anchor
reconfiguration. Wire shared CSS motion into the seven show/hide widgets, with inert
logical closure, cancellable leave, live reduced motion, server-closed attribute
adoption and disposal restoration. Use owner-document transition RAF/style/media and
preserve authored classes, including absent class attributes. Keep menu trigger ARIA
under one writer. Add colon-prefixed schema-backed directive option expressions and
controller-owned dialog portal configuration; make combobox projection/filter flags
reactive and coalesce equivalent projections/loaders. Bind lazy children when lazy
mode is disabled. Update source metadata/grammar and author additional unit/type and
browser fixtures. These candidates remain unexecuted; generated snapshots, public API
approval, generic portal target reactivity, borrowed-source policy, tooltip text/arrow
composition and final accessibility/size/runtime validation are not claimed complete.

Add schema-backed readable generic portal targets with one original position/logical
ancestry, shared-source leases, rollback, shadow-origin/destination handling and SSR
no-op. Share the Node SSR render lifetime between string output and demand-driven DOM
serialization; retain request ownership through streaming/cancellation and add
metadata-only onReady/shell framing without removing legacy full-result hooks. The
Node adapter uses non-buffered framing for constant cache policies and awaits child
SSR cleanup before loader disposal, including HEAD/406 paths. Snapshot renderer state,
never reuse a user-visible request Window as a template cache owner, bound diagnostic
keys and fence cache clear with an epoch. Author serializer/lifetime/100-request and
Node/portal regression fixtures. All remain unrun; API/size/throughput/coverage and
remaining 28-card acceptance gates are explicitly not certified.

Add a proposed optional `BindContext.skipChildren()` capability for owned content
without suppressing same-element directives. Tooltip expression composition uses it
and rejects unsupported custom hosts before mutation. Preserve authored fallback
and arrow nodes, literal text security, reactive arrow/trigger ownership and exact
presentation restoration after surface cleanup. Empty-expression content retains
normal binding. Shared Menu leases now reject competing configuration sources and
conflicting supplied values instead of silently ignoring them; preconfigured child
sources remain authoritative. These are API/compatibility proposals, not evidence
for the API-identical refactor card. Unit/type/browser regressions are authored and
unrun; API reports and release-owner review remain pending.

Authorize Date Picker's shadow stylesheet nonce before insertion; replace the sheet
on nonce rotation. Add a real CSP-header/browser form/axe fixture and native
storage-only two-tab Auth regressions. Narrow Menu/Tooltip role options to their
fixed roles in types and schemas; this compatibility proposal needs review.

Candidate a11y/head/router integration: reactive schema-backed directives,
reference-counted inert/tab-stop and scroll leases, shared route live-region and
head ownership, SSR head borrowing/restoration, literal authored-head projection,
selective dedupe and title-template callbacks, nonce/JSON-LD/link filtering, and
reentrant cleanup. Route loader results and metadata values use unknown rather
than any. Unit/type/browser/SSR fixtures are authored but unexecuted; generated
API/metadata and size budgets remain pending, and API/compatibility proposals
require acceptance before release. This changeset does not certify completion
of the 28-card scope or authorize a release.

Candidate Mock/Realtime continuation: per-installation worker protocol v2 and
abortable own-registration setup, independent page/session/request/socket cleanup,
HEAD/null-body/statusText fidelity, shared Resource-demo backend, abortable POST
passthrough, frozen schema-validated Mock defaults and descriptor-safe global
leases. Correct absolute ws/wss matching and socket callback lease semantics.
Realtime guards reentrant transport acquisition/close/parser/serializer/draining,
keeps ambient SSR autoConnect idle, and bounds ordered asynchronous Blob decoding.
Protocol copies must be updated together. Strict options and the receive-buffer
ceiling require compatibility review. Authored fixtures have not been executed;
no size, package or runtime acceptance is asserted.
