# @zenith/devtools-core

هستهٔ یکپارچهٔ L1 برای ابزارهای توسعهٔ Zenith (SPEC §۲.۷ / `#147`).

چرخهٔ `state ↔ devtools` را می‌شکند و دو رجیستری موازی پیشین (`state/registry.ts` و `devtools/api.ts`) را در یک رجیستری با شناسهٔ رشته‌ای واحد، Timeline، Time-travel (`snapshot`/`restore`/`replay`)، گراف زمان اجرا (`RuntimeGraph`) و رجیستری پنل (`registerCache`/`registerStore`/`registerApp`) یکی می‌کند.

## نصب و راه‌اندازی

```ts
import {
  installDevtoolsCore,
  getAllSignals,
  getTimeline,
  snapshot,
  restore,
} from '@zenith/devtools-core';

const devtools = installDevtoolsCore({ maxTimelineEntries: 1000 });
// در پایان چرخهٔ عمر:
devtools.dispose();
```

## Readable inspection and scoped installation (unvalidated candidate)

`UntypedSignal<T = unknown>` is a readable inspection capability. Registration,
naming and event recording accept that actual capability without claiming a
writable nominal Signal. Explicit generic arguments still check the readable
value type. Weak references retain the original object; time-travel writes remain
an explicit dynamic boundary that can reject missing/readonly setters.

Inspection and event/hook callbacks are untracked. Registration has reentry and
reset-generation guards; listener tokens cannot remove a later registration of
the same callback. Snapshot dispatch defers additions and observes removals.
Native hook invocation does not cast a narrow callback into an unknown-input one.

Multiple live installations can share the hook: disposing an older installation
must not unpublish the hook used by another. Every installation still needs its
own disposal. Configuration remains realm-global; this change does **not** promise
independent per-install configuration or restoration of an earlier external hook.
A newer external hook is not deleted by an older local disposer.

State host policy now blocks realm-global Devtools capture in Node SSR, including
route construction and prepass before a Document exists. Installing inside such
a scope is a no-op and does not change the outside configuration. This consumes
the new `@zenith/state/internal` entry: compatibility with already-published old
State releases is **not** claimed. Peer ranges must be reconciled by the approved
release plan; the current changeset is a proposal, not publication approval.

Readonly/generic, recursive/reset/listener, installation, real SSR privacy and
both State-format load-order consumer fixtures are authored, **not run**. This is
not evidence of passing package/type/size/security/release gates.

The same request policy now also excludes Core hook/state subscriptions, panel
App/cache/store registration/reads and snapshot/restore/replay. No-op registrations
return a shared cleanup rather than retaining request closures. Outside panels use
installation tokens, including same-value replacement/reset; old payloads are
released when replaced/cleared. Explicit **internal process reset** remains global.

Restore now constructs a concrete validated Snapshot instead of asserting that
unknown input already had that type. Missing legacy timelineLength normalizes to
zero; provided timeline length must be a nonnegative safe integer and optional
names must be strings. Unknown extra metadata is not forwarded as typed hook data.
This decoder validates snapshot shape, **not each Signal<T>'s value domain**;
time-travel remains an explicit caller-owned dynamic mutation boundary. Readonly/
unsupported setters are skipped. Native getter/clone effects are not undone.
Snapshot reads are untracked. Time-travel operations use tokens and an epoch:
reset invalidates sleeping replay, overlap cannot prematurely unmute capture, and
native getter resets prevent stale writes/events. Existing replay pacing is kept.
Disposing then explicitly re-inspecting an actual raw Signal allocates a fresh ID;
raw Signals are not revoked. Invalid hook installation does not apply its config.
These behavior/decoder fixtures are authored, not executed or release-approved.

### Graph boundary and options candidate

```ts
const local = new RuntimeGraph();
local.addSignal('count', { name: 'count', value: 1 });
local.addDirective('text', {
  directiveType: 'zen-text', elementSelector: '#count', expression: '$count',
});
```

Legacy positional forms remain deprecated (101–102). The exported `runtimeGraph`
/ `graph` is realm-global and obeys native SSR/explicit-disable policy; explicit
local instances remain caller-owned, without implicit request disposal. Snapshots
copy metadata/dependency arrays but preserve opaque value identity. Kind changes
remove old data/edges; edge identities do not collide on `|` in user IDs. Per-kind
node limits remain 500. Untracked getter capture drops work invalidated by reset.
Unknown legacy hooks are natively checked/invoked without fabricated interface or
result casts. Reentrant forwarding is bounded. Explicit process reset clears the
singleton even in a muted scope; it is not a request-scoped API.

Graph/options/native bridge/duplicate-module telemetry and 100-render SSR privacy
fixtures are written, **not run**. Constructor/duplicate Core module identity and
package/type/size/peer-floor acceptance remain open. Internal source-only reset /
policy helpers are not new public exports; existing root internal bridges remain.
