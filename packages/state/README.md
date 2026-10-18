# @zenith/state

موتور Reactivity فریم‌ورک Zenith — یک سیستم واکنش‌گرای دقیق، سریع و قابل‌اعتماد برای ساخت رابط‌های کاربری مدرن.

## ویژگی‌ها

- ✅ **Signal** — ظرف‌های واکنش‌گرا با Dependency Tracking خودکار
- ✅ **Effect** — توابع واکنش‌گرا با قابلیت Dispose
- ✅ **Computed** — مقادیر محاسباتی با Caching هوشمند
- ✅ **Batch** — بهینه‌سازی Performance با اجرای دسته‌ای
- ✅ **Environment-agnostic** — بدون وابستگی به DOM

## نصب

```bash
npm install @zenith/state
```

## استفاده

```typescript
import { signal, effect, computed, batch } from '@zenith/state';
```

برای مثال‌های کامل، به [README اصلی](../../README.md) مراجعه کنید.

## تست

```bash
npm test
```

## پروتکل cleanup (موج #116 / DEC-032)

- `effect` یک `Cleanup` (`() => void`) برای آزادسازی برمی‌گردانند؛
  اجرای دوبارهٔ آن بی‌اثر است (idempotent).
- `onCleanup(fn)` و `registerCleanup(cleanup)` یک `Cleanup` برمی‌گردانند که فقط
  ثبت خودشان را حذف می‌کند (با محافظ هویت).
- `onEffectError(handler)` برگشت‌پذیر است: `Cleanup` آن هندلر را تنها در صورتی
  پاک می‌کند که همان هندلر ثبت‌شده باقی مانده باشد.

> `Cleanup` همان `() => void` است که در `@zenith/shared` تعریف شده؛ state به‌دلیل
> DEC-021 آن را inline نگه می‌دارد (نه import از shared).

## مجوز

MIT


## Unknown capability boundaries (migration candidate, unvalidated)

`isWritable(value)` detects a callable setter; it does not prove that a getter
exists or that arbitrary data is accepted by that setter. An unknown value is
narrowed to `WritableCapability` with a `never` input domain. Use a known
application-owned `Signal<T>` or validate an external contract before writing.
Checking a known `Signal<number>` does not widen its numeric setter.

Reactive subscribers use `EffectSubscriber = () => void`, matching their actual
scheduler invocation. Callback identity and existing scheduling order are
intended unchanged; broad `Function` parameters are no longer the contract.
Legacy registry records retain unknown values, original weak references and
independent deprecation metadata. These source-contract changes are distinct
from module moves. Root integration-hook/member classification and consumer/
lifecycle validation remain open, and no current-tree gate result is claimed.

## Owned lifecycle candidate (2026-10-18; not yet validated)

- `effect` restores the caller's tracking/cleanup context and owner in `finally`,
  including nested startup failures. Children created by its previous execution
  are disposed before re-execution; failed effects release their partial graph.
  Explicit `owner: null` detaches; an omitted/undefined owner inherits. A disposed
  parent cannot acquire a running child. Explicit numeric urgent priority `0` is
  honored in an options bag.
- `createRoot` is detached and synchronous. Its callback restores the ambient
  owner even when it throws. Calling its disposer later does not reset a different
  caller's owner. Teardown is untracked, idempotent and best-effort across callbacks.
- `computed` performs one tracked computation on its first read, with no placeholder
  signal. Initial failures are rethrown unchanged (even `undefined`), release partial
  dependencies and can be retried while live. Recursive initialization throws.
  Native observer reads during inner creation/update do not become dependencies.
- Computed disposal is terminal: an initialized value retains a non-subscribing
  snapshot; reading an unread disposed value throws. Disposal releases its source
  subscriptions, downstream subscribers and computation callback. Observer creation
  count/timing therefore changes; this is **not** an API-identical extraction.
- Watch callback cleanup now follows parent disposal; immediate `once` watches
  release their startup subscription. A watch callback's own cleanup registrar is
  per-callback. In contrast, general `onCleanup` remains **owner-bound**, not a new
  effect-per-execution cleanup API.
- Async state follows its captured parent, aborts active work on teardown and
  suppresses stale writes. `immediate: false` starts tracking on explicit `refresh`;
  later dependency changes remain reactive. A current AbortError clears loading.
  Async work and resource creation after `await` do not acquire ambient ownership
  automatically; callers still need explicit async/request lifetime design.

These runtime and type fixtures are authored, **not executed**. Scheduler,
SSR/request-context, native observer, declaration and consumer integration still
require the final validation phase. Raw `Signal` instances retain their native
read/write/dispose semantics; this pass does not make every signal terminal.

### Callback/type classification continuation (unvalidated)

`WatchCallback` overloads retain their source/previous/cleanup correlation, while
the private erased invocation uses a native callback boundary rather than
`WatchCallback<any, any>`. Callback return values are ignored, as before.
`EffectFn` now aliases the actual zero-argument void subscriber contract; an effect
never promised to invoke a cleanup returned by its callback. Use owner-bound
`onCleanup` or the per-watch cleanup registrar explicitly. This is a source-type
correction, not a new callback-result decoder or per-run cleanup policy.

Documented State user-facing types/observer hooks and every live watch overload
now carry explicit public metadata; legacy batch/error aliases retain independent
deprecation. Root integration hooks are not promoted or removed to make an export
gate pass. Internal-entry/singleton and full member/export classification still
need completion/review. Native callback order/receiver, tuple inference, negative
callback types and real-source metadata have new **unrun** fixtures.

Deep watch observation now has a private graph separate from its callback payload.
It tracks nested readable values without handing a plain/unwrapped clone to a
callback that is typed to receive the original T. Callbacks get actual source
values; for immutable replacement, `previous` is the previous source value, and
for an in-place nested change it can be the same object as `next` (not a historical
clone). Structural root readables need only the declared `get()` capability.

The graph handles cycles, bigint, functions and symbol fields without calling
`toJSON`; class/native identity and enumerable data are observed rather than
fabricating plain objects with class methods. A 10,000-node/value budget is
conservative, not certification of arbitrary proxy/Map/Set/native mutation. A
getter or prior callback cleanup that disposes the watch prevents later traversal
or callback invocation. These are separate **behavior/type-correctness changes**;
all deep-watch runtime/type/export fixtures are authored and unrun.

## Host contexts and internal entry (candidate — not validated)

Ordinary applications continue to import `signal`, `effect`, `computed`, `watch`,
`createAsync` and the public owner APIs from `@zenith/state`. Host integrations use:

```ts
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
```

`./internal` has an explicit **internal**, not public, entry level. It is a narrow
self-package facade over the root, in both ESM and CommonJS; it must not bundle a
second set of relative implementation modules. Its implementation and declaration
references resolve to the canonical root **within the selected format**. Legacy
root integration names are retained, tagged internal, pending explicit removal/
migration approval. Adding this bridge does not make the root public-only and does
not certify ESM/CJS `Signal` constructor identity or all mutable observer/registry/
priority channels across formats.

An `EffectContext` owns its current owner as well as active tracking. An optional
host `bind` captures the native execution context **at each registration**, keeps
argument/result types and exceptions intact, and must return a synchronous callable
that invokes the callback synchronously when called. It must not eagerly invoke,
queue or replace the callback result. Hosts without native async contexts can omit
it; State still restores the captured tracking/owner context for synchronous work.
The State package itself imports no Node/DOM APIs.

Queued effects, late owner teardown, lazy computed initialization, explicit async
refresh/abort and watch cleanup now use their creation context. A computed then
subscribes the reader in the reader's context. Overrides are synchronous and use
`finally`; `createRoot(async ...)` still does not establish implicit lifetime
ownership for arbitrary continuations after `await`. Explicit owner options retain
their lifetime semantics; they are not a substitute for capturing host execution.
Caller-retained bound functions can retain their native context until released.

These are **behavioral corrections**, not API-identical file moves. Provider,
native async, lazy/cross-context, 100-scope, built-condition and type/metadata
fixtures have been authored but have **not** been executed or compiled.

### Shared diagnostic channels and scoped compatibility registry (candidate)

The new private `zenith.state.runtime.v1` holder shares the observer installation
slot, legacy notification hooks, effect-priority metadata and global effect-error
registration between State formats. Observer cleanup is **installation-token**
based: identical observer objects can be installed twice, out-of-order cleanup
unlinks only its own installation, and a temporary null override does not revive
a disposed observer. Release every returned cleanup. Global effect-error handling
retains replacement/clear semantics (not an observer-style restoration stack).
Neither shared data nor readable branding makes ESM/CJS constructors identical.

Default priority now belongs to the selected EffectContext. The fallback context
is still shared by ordinary imports; a fresh native request starts at normal
priority rather than inheriting another request/event's temporary setting.

The deprecated registry is a **context view**, not a process-wide view of other
requests. Shared Signal identity is kept in weak owner associations; automatic
writes notify each explicitly registered live view, even if another context writes.
Manual `recordStateChange` records in the selected view. IDs are process-monotonic
and never rewound by clear. Listener registrations have tokens; reset/removal takes
effect during snapshot dispatch, additions start next event, and diagnostic reads
are untracked. Native getters can still run user code; recursion/generation guards
drop stale registrations instead of fabricating an accepted record.

Hosts can provide `EffectContext.registerDisposal` for the **whole host lifetime**,
not the first child effect that happens to construct a Signal. Retirement clears
records/timeline/listeners, unlinks scope ownership and refuses later reactivation.
Without that hook, hosts own explicit clearing/context lifetime. An explicit
`__ZENITH_DEVTOOLS__ = false` disables legacy capture even in development.

The internal `isGlobalObservationEnabled` hook communicates host policy to global
diagnostics. Node SSR disables global observer notifications before route/prepass
Signal creation while retaining its isolated compatibility view. This is not a
payload decoder or a guarantee against arbitrary caller-held Signal/value copies.
Naming notifications expose `ReadonlySignal<T>`, not an invented writable class.
All these runtime/type/built-consumer fixtures remain **unexecuted**. Root export
migration, cross-format constructors/declarations and release peer-range review
remain open; consumers of the new internal entry require the proposed State release.
