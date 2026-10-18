# @zenith/testing-e2e

Test-only Playwright fixtures (#166). The root is a **Node** entry; the separate
`@zenith/testing-e2e/browser` entry is built for browsers. Optional runtime-core,
state and scheduler peers are needed only for the browser mount host.

```ts
import { test, mountApp, getSignal, expectNoA11yViolations } from '@zenith/testing-e2e';

test.use({ zenithOptions: { baseURL: '/test-host.html' } });
test('counter', async ({ page }) => {
  await mountApp(page, {
    html: '<h1>Counter</h1><input aria-label="Count" zen-model="count"><p zen-text="count"></p>',
    state: { count: 'one' },
  });
  await page.getByRole('textbox', { name: 'Count' }).fill('two');
  // getSignal reads the actual mounted App signal, not a parallel mock.
  await getSignal(page, 'count');
  await expectNoA11yViolations(page);
});
```

The test-only host imports `installTestMount` from the browser entry and calls it
after its document body exists. It must resolve Zenith peers through its bundler
or an import map; `e2e/app-harness.html` is the repository's concrete example.
**Do not ship this host or its signal-mutation bridge in production.** HTML is
trusted fixture source, not an HTML sanitizer or an application upload facility.

`mountApp` accepts `url` (overrides `baseURL`), or HTML on an already loaded host.
`state` values are serializable initial data converted to actual signals. Plugins
are serializable module descriptors, not functions crossing Playwright's process
boundary: `{ module: '/plugin.js', exportName: 'default', options: {...} }`.
The export must be an installable plugin object. Import failures/timeouts reject;
a cancelled or superseded import cannot create a late App. Each remount disposes
the previous App, listeners, signals, bridge and DOM. `unmountApp(page)` performs
explicit cleanup; the automatic fixture also unmounts before diagnostics teardown.
A retained disposed host cannot reopen. Missing hosts/readiness fail, never pass
because a document merely exists. `mountTimeout` bounds module loading; both it
and `hydrationTimeout` default to 5000 ms, with no fixed boot sleep.

For applications with their own boot/hydration, install `installTestBridge` with
actual signal accessors and a readiness callback reflecting real completion;
URL-only `mountApp` waits on that callback. Bridge leases restore original property
descriptors, reject unknown/readonly signal writes and cannot erase a newer owner.

`test` attaches bounded, redacted console/pageerror capture before navigation.
Errors fail by default; `failOnConsoleError: false` is only for dedicated negative
fixtures. `expectNoConsoleErrors` without capture rejects rather than reporting a
vacuous pass. `expectNoA11yViolations` supports `rules`, `exclude` and minimum
`impact` (default serious, also covering critical). `DEFAULTS`,
`e2eOptionsSchema` and `validateE2eOptions` expose the configuration contract.
`snapshotDevtools` returns the installed application's supplied snapshot; the mount
host supplies actual signal values and App registry names, not fabricated protocol
traffic. This does not yet exercise the full devtools transport.

## Status

Unit, real App/component, native WS/SSE and negative timeout/console/axe tests are
**written, not run** under the code-first instruction. Root Playwright retains
failure traces/HTML reports. Full demo/UI-package/SSR hydration consumption, API
reports, packed consumers and target/size gates remain pending; this is not
completion of #166 or a production-readiness claim.
