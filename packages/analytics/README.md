# @zenith/analytics

Consent-first analytics, with no dispatch, event queue or session allocation on
SSR. Without required consent or while DNT is enabled, events are discarded,
not retained for later replay. Revoking consent clears queued events, session
identity and the batching timer immediately. Already-issued provider requests
cannot be retracted; the engine starts no subsequent sends after revocation.

```ts
import { createAnalytics, beaconProvider } from '@zenith/analytics';
const analytics = createAnalytics({ providers: [beaconProvider({ url: '/analytics' })] });
analytics.setConsent(true); // only after the application's consent flow
analytics.track('purchase', { total: 25 });
await analytics.flush();
analytics.dispose();
```

Standalone defaults: batch size 10 / interval 5000 ms; sample rate 1; session
expiry 30 minutes; at most 100 queued events and 100 unresolved provider sends.
Events over capacity are dropped, not allowed to grow memory indefinitely.
Session identifiers use a CSPRNG and are neither persisted nor created before
consent. Sampling randomness and clocks can be injected for deterministic tests.
`DEFAULTS`, `analyticsOptionsSchema` and typed options are public.

Nested `token`, `password`, `authorization`, `secret`, `cookie` values are redacted
by default. Customize `redact` for application-specific PII. Immutable event copies
are bounded in depth/array/key/string sizes; getters and custom `toJSON` methods
are not executed. Consent does not automatically make arbitrary event names/user
IDs non-sensitive; applications remain responsible for the data they choose.
Provider failures are observed, isolated, and reported as `ZEN-1901` without raw
exceptions, identifiers, event names, props or provider names in diagnostics.

Providers: `consoleProvider` uses the logger (or an injected sink), `gtagProvider`,
`plausibleProvider`, and `beaconProvider`. Factories are inert; they do not initialize
trackers or send requests before a consent-checked dispatch.

`analyticsPlugin` installs an App-owned engine and `track` binding; supply a router
with `afterEach` to enable automatic page views. `bindTrack` supports click, submit,
change and visibility; legacy `trigger:event`, props expressions, `data-label`,
`zen-track-label`, once and debounce. Cleanup cancels observers/listeners/timers, including pending debounce on DOM
removal or plugin uninstall. Native string-route hooks and object-route adapters
are accepted; props resolve lazily against App state and local context.
The factory-style runtime facade uses the same engine with batch size 1.
The deprecated DOM callback adapter uses canonical `bindTrack` and a canonical
engine per binding, with default-App ownership. It preserves deferred callback
delivery, but never infers consent from installing a callback:

```ts
configureAnalytics((name, element) => reportTrustedLocalEvent(name, element));
setAnalyticsConsent(true); // only after the application's consent decision
// or configureAnalytics(handler, { consent: true }) after an explicit grant
setAnalyticsConsent(false); // cancels queued callbacks, including revoke/regrant
```

DNT is checked both when an event is accepted and before a deferred callback.
Replacing a handler cancels old queued events and starts a fresh consent/session
boundary. Once bindings finish their one accepted delivery before releasing their
engine; manual cleanup, DOM removal and default-App disposal cancel pending work.
The trusted legacy callback still receives its local element for compatibility;
the element is **never serialized into analytics event props**. This consent-first
legacy behavior is an intentional runtime major proposal, not a patch guarantee.

## Implementation status

Implementation and tests are written, **not yet executed** under the user's
code-first instruction. Package/runtime/plugin, privacy, SSR and size gates have
not been certified; nothing here closes #155 or claims production readiness.
