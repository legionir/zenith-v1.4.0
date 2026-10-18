# @zenith/a11y

Shared L2 accessibility primitives. ESM; DOM/listeners are acquired on invocation,
not import. State and scheduler are peers. Core, notifications and UI use this
same focus/scroll implementation, rather than independent trap stacks.

```ts
import { createFocusTrap, createIdScope, useId, a11yPlugin } from '@zenith/a11y';
app.use(a11yPlugin());
const ids = createIdScope('checkout'); // allocate once per request/App
const titleId = useId({ scope: ids });
const trap = createFocusTrap(dialog, { initialFocus: '#confirm' });
trap.activate();
// owner teardown:
trap.dispose();
```

- `getFocusable`, `focusFirst/Last`, `restoreFocus`; dynamic hidden/disabled checks.
- `createFocusTrap`: per-document nested stack, pause/unpause, Escape/outside click,
  initial/fallback/return focus and automatic cleanup on connected-root removal.
- `createRovingTabindex`: horizontal/vertical/both, RTL, Home/End, disabled skip;
  cleanup restores original tabindex values.
- `lockScroll(document)` and `inert(element)` return counted, idempotent leases.
- `prefersReducedMotion(document?)` returns an owned readable with `dispose()`;
  `reducedMotionMatches()` is the legacy instantaneous boolean facade.
- `createLiveRegion`, `announce`, `installRouteAnnouncer` own their timers/hooks.

Plugin attributes: `zen-focus-trap`, `zen-autofocus`, `zen-inert`,
`zen-scroll-lock`, `zen-roving`, `zen-live`, `zen-announce`, `zen-reduced-motion`.
Bindings are App-owned and client-only during SSR. Outside an owner, `useId()`
uses a client fallback counter: **pass an explicit per-request scope for SSR**;
reuse its seed/order during hydration. IDs are not a security token.

Implementation and regression tests are written; final keyboard/axe/browser,
pack/target and gzip-budget validation is still pending. This is not an audit certificate.

`registerEscapeLayer(document, handler)` shares a single document listener with
focus traps and floating UI. A handler returning false declines; exactly one
accepting layer consumes the event, including when its close callback throws.
The cleanup removes that registration and removes the listener after the final
layer leaves. Composing/prevented events are ignored.

## Reactive directives and ownership (candidate contract)

Install `app.use(a11yPlugin())`. The boolean directives `zen-trap`,
`zen-inert` and `zen-lock-scroll` react to their expressions; `false` releases
only that binding's lease. Their `-options` companions accept an object (or an
expression evaluating to an object), validated through the shared schema layer.
`zen-announce` accepts reactive text and `zen-announce-options` configures its live
region. Detached bindings and App disposal release effects, listeners and leases.

```html
<section zen-trap="$open" zen-trap-options="{ returnFocus: true }">
  <button>Close</button>
</section>
<aside zen-inert="$open"></aside>
<div zen-lock-scroll="$open"></div>
<p zen-announce="$status" zen-announce-options="{ politeness: 'polite', clearAfter: '2s' }"></p>
```

`initialFocus` also accepts a callback evaluated on each activation.
`includeHidden` does not permit disabled or inert descendants. Unsupported native
`inert` uses reference-counted tab-stop masking, including inserted descendants;
the final release restores the original `tabindex`, inert and ARIA state.
`lockScroll` restores the original overflow value and priority on its final lease.
Explicit SSR documents avoid DOM focus, motion subscriptions and announcements.

`installRouteAnnouncer` owns its router subscription and uses
`[data-zen-main], main` by default, temporarily adding `tabindex="-1"` only when
needed. Its default message is `رفتید به ${title}`; customize `message` for the
application language. `@zenith/router` delegates to this implementation and can
share an explicit head manager and route metadata. Legacy `focusSelector` and
`formatAnnouncement` remain accepted; an explicit `message` takes precedence.

These changes and their new unit/type/browser fixtures are **not yet validated**.
The ≤5 KB budget, final API compatibility and manual assistive-technology checks
remain release gates; authored browser coverage is not screen-reader QA.
