# @zenith/runtime-core

هستهٔ کوچک L3 زمان اجرای DOM فریم‌ورک Zenith (SPEC §۲.۸ / `#148`).

- مدل نمونهٔ مستقل `createApp(options)` (بدون حالت سراسری؛ چند نمونهٔ هم‌زمان روی یک صفحه و در SSR).
- اولویت اجرای قطعی دایرکتیوها (`zen-for` 1000 → `zen-if` 900 → `zen-memo` 800 → `zen-ref` 700 → دایرکتیوهای عادی 500 → `zen-action` 100) و تشخیص تداخل ساختاری (`ZEN-2302`) و الزام `zen-key` (`ZEN-2303`).
- قلاب‌های چرخهٔ عمر (`onMount`, `onUnmount`, `onUpdate` — خارج از محدوده `ZEN-2301`) و تزریق وابستگی درختی (`provide` / `inject`).
- Hydration سمت کلاینت (`hydrate` / `startFromSSR` با نشانگر `data-zen-h` و کد `ZEN-2310`).


## Remediation contract work (#118/#120; unvalidated)

`app.registries` exposes independent `actions`, `components`, `auth`, `permissions`,
`resources`, `stores`, `serverComponents`, `directives`, `plugins` and `devtools`
stores. Each has `register(name, value) -> Cleanup`, `get`, `has`, `list`,
`entries`, `unregister`, `subscribe` and `dispose`. Cleanup is registration-bound, even when
exactly the same object/function is registered again. `list`/`entries` are copies.
These are reference stores: values are not implicitly destroyed; the creating
plugin/factory must return its lifecycle cleanup. Registries close on App disposal.
`subscribe(callback)` observes changed names, or `null` on final disposal, never
value payloads. Stale cleanup/missing unregister emit nothing; unsubscribe is
idempotent. Observer failures are isolated with a generic diagnostic, not raw
exception data, and cannot invalidate a completed registration.

The real directive/action/plugin engine now uses these same stores. No ambient
async App switching is introduced: retain an explicit App across `await`.
Failed plugin installs can retry, failed initial installations clean earlier
plugins, partial mounts roll back listeners, and one throwing teardown cannot
skip other roots/plugins or registry clearing. A default-App global-reset hook
also serves `testing.resetForTesting`; it never clears independently created Apps.

This is **not yet complete migration of #118**: legacy Store/Resource,
components, permissions, server-component and devtools module registries still
need adapters to their App-owned stores. Auth now has a lazy higher-layer bridge
from the runtime facade to the actual default App inventory; Auth alone keeps its
standalone fallback. The default App detaches before dispose callbacks, including
reentrant calls. These new Auth/registry-observation paths remain unvalidated. Tests for explicit App ownership are not
proof that those unmigrated singleton paths or all concurrent SSR paths are safe.

`DirectiveDefinition.stateOutput` lets a structural binding interpret `zen-state`
as its output name instead of JSON local state (used by the new realtime plugin).
`createBindingContext` from expressions supplies lazy shared signal/dollar-alias
resolution. Full legacy-binder/metadata migration remains open. All new tests are
written but intentionally not executed until the final validation phase.

### Code-first ownership/type migration (pending major approval)

`BindContext` and App extension state use unknown-valued records. Directive
`processChildren` returns a Cleanup for that subtree; it is also attached to its
captured owner, and delayed calls after teardown do not bind. Structural branches
and rows release listeners immediately and restore their source templates on
unmount; initial binding failures roll back acquired subtrees. Lifecycle callbacks
re-enter the originating element scope. `hydrate().cleanup()` releases the App it
created and its hydration-created signals, not merely the root's listeners.

Core is split into small implementation/type modules. Public contract corrections
are intentional major proposals, not evidence of an API-identical refactor.
No final API report, typecheck, test, build or browser gate has run for this tree.

### Owned content capability (additive API proposal; unvalidated)

A directive can call `ctx.skipChildren?.()` while binding to suppress the walker's
**automatic** descent into that element. Other directives on the same element still
bind in priority order. The decision applies only to this walk/mount, not globally
or to a later remount. `ctx.processChildren(node)` remains available to explicitly
bind owned content under the captured scope; its cleanup belongs to that scope and
late calls after owner disposal are inert. Structural directives keep their existing
short-circuit behavior. This capability does not resolve competing same-element
DOM writers; directives must not concurrently replace the same content.

This optional API lets the UI Tooltip text projection retain authored fallback and
arrow nodes without accidentally executing fallback bindings. Expression tooltips
require the capability; older custom UI hosts can continue using empty-expression
(authored-content) tooltips. The change needs API-report/compatibility/release review
and is separate from the API-identical extraction requested by #40. The owned-child
and composition regression fixtures are authored, not executed.
