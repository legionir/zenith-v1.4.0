---
'@zenith/actions': major
'@zenith/components': major
'@zenith/compiler': major
'@zenith/security': major
'@zenith/crud': major
'@zenith/data': major
'@zenith/devtools': major
'@zenith/devtools-core': major
'@zenith/events': major
'@zenith/errors': minor
'@zenith/expressions': major
'@zenith/form': major
'@zenith/http': major
'@zenith/router': major
'@zenith/runtime': major
'@zenith/ssr': major
'@zenith/state': major
'@zenith/stateful': major
'@zenith/testing': major
'@zenith/i18n': minor
'@zenith/service-worker': minor
'@zenith/transition': minor
'@zenith/data-table': major
'@zenith/store': major
'@zenith/suspense': major
'@zenith/virtual-list': major
---

Proposed shared-API contract migration, not a release authorization or validation
result. Dynamic public values default to unknown; Form validation preserves field
inference; Router uses a genuine context-aware Signal and fails closed without
native request isolation. Add options-object overloads while retaining deprecated
positional bridges, and explicit Node/worker subpaths. Auth/Form/cache module moves
are tracked separately from behavioral/source-contract changes in
`docs/API-MIGRATION-CANDIDATE-2026-10-17.md`.

No generated declarations, compatibility measurement or test result is claimed.
Existing root internal exports and major compatibility approvals remain open.

Runtime custom-directive registration and parity diagnostics now have canonical
schema-validated option bags and deprecated positional bridges (086–088). The
legacy custom registry also gains a detached names inventory; stale cleanup no
longer unregisters a newer registration reusing the same callback. This is a
separate correctness/API change, not part of the compatible module moves.

ReadonlySignal no longer advertises update(), and Computed implements the real
read-only peek/subscription/disposal capabilities without a double assertion.
Form field/array computed views are readonly rather than fabricated Signal<T>s.
Devtools values are unknown/read-only inspection capabilities; restore/replay use
an explicitly dynamic setter boundary with the actual receiver. These are
candidate source-contract/capability changes requiring major/API review, not
proof of ABI compatibility or permission to release.

Additional candidates: DataTable dynamic cell/key/editor values expose unknown
while concrete row types retain inference (including interfaces without an index
signature). Column filtering adds validated canonical options with legacy bridge
089. Suspense context/tracking/timeout canonical options are validated; internal
callers use them, zero-argument context creation is canonical, and explicit
undefined legacy timeout/callback arity is retained. Legacy negative timeout
behavior stays on the deprecated path. Store and virtual-list boundaries no longer
use erased writable Signal<any>/Store<unknown> storage. DataTable/Suspense module
extractions and formal overload metadata repairs are recorded separately in the
migration ledger; no final size, declaration or runtime result is claimed.

Compiler/Testing/Security owner extraction is tracked separately from the
contracts: parity state becomes unknown; canonical runner/render/directive/HTML
sink bags validate configuration and keep warned positional bridges 090–094.
Trusted Types policy outputs are unknown (native opaque values), not asserted
strings. Node compiler parsing declares its sync-or-async private result and an
optional jsdom 24 peer; browser-only consumers need not install it. Numeric fake
timers retain their runtime handles and do not pretend to supply Node Timeout
methods; partial-install rollback is a separate lifecycle correction. These are
unvalidated proposals, not approved majors or a guarantee of CJS/size parity.

State's broad Function subscriber inputs become explicit zero-argument callbacks.
Unknown writable detection no longer invents a readable Signal or arbitrary
setter input domain; native runtime model/ref/persist/hydration writes remain
explicit, receiver-preserving and unvalidated at the application-domain level.
Form gains canonical schema-checked validation/lifecycle/store-method bags with
retained positional bridges 095–100. Evaluator/type/state-construction moves are
tracked independently of those source/behavioral changes. No root integration
hook is silently promoted to public, no major is authorized, and all new runtime,
type and real-facade metadata fixtures remain unrun.

State/Form lifecycle correctness candidates are also behavior changes, not module
moves: nested effect/owner restoration, prior-run child disposal, explicit-null
ownership, terminal lazy Computed snapshots/error semantics and observer timing,
watch parent/once cleanup, owned async abort/deferred refresh, Advanced/Wizard
`dispose()` and captured field-view ownership, stale async write suppression,
wizard reset/step validation, independent Store validation leases and robust
teardown. Existing exposed native signals and user promises are not magically
revoked/decoded/aborted. Array undefined movement and non-array guard fixes are
recorded separately. These proposals remain unvalidated and unapproved for release;
remaining callback/export/generic/request-context work is not declared complete.

Further source/behavior candidates: Form factories no longer certify an absent
initial T, dynamic field-name dispatch exposes its honest union, empty-step calls
return Wizards, schema Store adapters bypass ambiguous routing, and the small
reactive API has ownership/disposal. Dirty comparison supports non-JSON/opaque
payloads with bounded conservative semantics; array shape/swap/restored-dirty and
manual-error precedence are explicit correctness changes. Watch's internal erased
callback no longer uses any; EffectFn advertises the actual ignored-return void
protocol. Public type/overload metadata is explicit without promoting internal root
hooks. Source/lint/declaration rest tuple/union inventory and exact operand-protocol
leases have authored fixtures only. No release, compatibility or validation is
approved by this candidate.


Further source correction in the same pass: deep watch now observes a private
bounded cyclic/non-JSON graph while callbacks receive the actual typed source
values, not unwrapped/plain clones pretending to be T. Structural get-only roots,
nested tracking, raw previous identity, class methods and disposal during getter/
previous cleanup have authored runtime/type/private-export fixtures. This is an
explicit callback payload/previous-value contract change, not a compatible move;
no test, gate, CI/push or acceptance ran.

Additional unvalidated State/SSR candidate: add the internal State self-package
facade without removing legacy root names or creating another same-format runtime;
make owner/tracking selection consistent per host context; bind queued effects,
late disposers, lazy computed initialization, watch cleanup and async controls to
creation context. Node SSR captures native contexts per registration, shares its
DOM store/App claims across formats, always isolates the route (default `/`), owns
prepass/async-factory reactivity and retires request ownership before resource
release. These are behavioral corrections, not API-identical refactors. Explicit
detach/user Promise side effects and pre-existing mixed-format root class/observer/
registry/priority identity debts are not silently solved. Fixtures are authored,
not run; entry addition is not root-public-only completion or release approval.

State diagnostic channels now share private data across formats, with observer/
error installation identities, context-local default priorities and scoped legacy
registry retirement. State naming callbacks receive a readonly capability; modern
Core exposes generic-readable registration instead of fabricated writable identity.
Core inspection/listener/hook reset work is untracked and guarded against reentry;
install tokens prevent premature hook removal without promising independent config.
Node SSR blocks realm-global diagnostics before route/prepass creation and closes
its local legacy view before App/DOM release. New internal-entry consumers require
the proposed State release: approved release planning must reconcile peer floors.
These are contract/default migrations, not API-identical refactors. Constructor/
mixed-declaration identity, root public-only exports and all acceptance gates remain
open. Built runtime, actual SSR privacy and compiled packaged type fixtures have
been authored but not executed. No release authorization or passing result implied.

Core hook/listener/panel/time-travel APIs also honor the SSR host policy. Outside
panel leases are identity-based and release obsolete payloads. Snapshot shape is
concretely decoded (legacy missing timeline metadata defaults to zero), not asserted
from unknown; payload-domain compatibility remains caller-owned. Reset invalidates
sleeping replay and native setter getter work; overlapping operation tokens avoid
premature capture unmuting. Raw Signal reinspection gets a fresh diagnostic ID and
incompatible hook install does not commit config. These are authored contract and
lifecycle changes with unexecuted fixtures, not compatible-refactor/gate evidence.

Graph, retained browser-hook and compatibility panel paths now honor the native
SSR host policy, including metadata/subscription/control access. Explicit local
RuntimeGraph instances remain caller-owned. Foreign graph globals and walker
telemetry use native capability checks, real receivers and ignored results rather
than interface/result assertions. Weak element identity/reentry data is shared
across duplicate/HMR walker modules. Browser lifecycle cleanup owns only its exact
publication/listeners and revokes stale hooks; metadata histories are bounded.
Panel capture/subscriptions are nontracking, identity/epoch guarded and release
obsolete refs. Graph snapshots copy metadata and use unambiguous edge keys.

Add diagnostic options and deprecated compatibility 101–105, with protocol-2 graph
negotiation for native hooks and preserved unmarked foreign transport. Explicit
process reset clears owned graph/panel/browser diagnostics; its registration is
not pure. Classify public types/internal bridges without silently promoting private
holders. Declare Devtools' direct Errors dependency and propose catalog additions
as an Errors minor update. These contract/retention/type/lifecycle changes and all
new browser/100-render/type/transport fixtures remain unvalidated, not a release
approval. Peer floors, root public-only exports, mixed constructor/Core identity,
Edge parity and external acceptance remain open.
