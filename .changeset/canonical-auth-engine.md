---
'@zenith/auth': major
---

Proposed compatibility/security migration for review: route the legacy functional
surface through the canonical Auth engine and normalized AuthConfig; add explicit
App-owned auth plugins/reference registries, generation-safe request cancellation,
owned timers/cross-tab invalidation and shared @zenith/storage records. Add explicit
HttpOnly-cookie refresh mode without JavaScript refresh tokens.

Exports remain available, but this deliberately marks potentially breaking
behavior/types for release-owner review: public custom values become unknown,
registration is memory-only by default, class persistence becomes a versioned
session record, browser endpoints must be same-origin, functional calls no longer
use global HTTP interceptors, helper operational failures return null, and removing
a borrowed registry reference no longer destroys the caller's Auth instance.

No version command, fixed-group bump or publication has occurred. This is proposed
release metadata, NOT approval to publish a major version. API baselines, full
compatibility/security/browser acceptance and final tests are still pending. The
lazy runtime facade now bridges the legacy Auth registry to the actual default
App inventory, including adoption, borrowed/owned lifecycle and name-only reactive
reference observation. Minified-consumer/reset/tree-shaking tests are written but
unrun. Auth declares its observable reset side effect; runtime-only signal imports
must still meet the unchanged budget. Other #118 registry domains remain unfinished.
