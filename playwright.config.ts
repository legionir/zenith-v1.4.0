// Playwright config for the #79 browser-e2e CI stage.
// Scope: one smoke test that boots the real built ESM bundles in Chromium —
// proof that build output is consumable by a browser and the reactive
// pipeline updates the DOM. Full directive/hydration e2e lives in #28/#33.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15_000,
  // CI: one retry so a timing flake in a real browser engine is reported as "flaky" instead of
  // failing the job; a deterministic failure still fails twice and stays red.
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8089',
    trace: 'retain-on-failure',
  },
  // Local sandbox override: use the preinstalled Chromium when PLAYWRIGHT_BROWSER_PATH
  // is set (CI leaves it unset and runs Chromium, Firefox, and WebKit per #32).
  projects: process.env.PLAYWRIGHT_BROWSER_PATH
    ? [
        {
          name: 'chromium',
          use: {
            browserName: 'chromium',
            launchOptions: { executablePath: process.env.PLAYWRIGHT_BROWSER_PATH },
          },
        },
      ]
    : [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
      ],
  // CI diag: ZENITH_E2E_NO_SERVER=1 means the workflow started scripts/e2e-server.mjs
  // itself (kept alive after test failure!) so post-mortem curl probes can inspect
  // what the static server actually served while tests timed out.
  // #33: the template matrix boots built fixtures (scripts/build-template-fixtures.mjs).
  // Without them the spec fails closed; the main e2e job (no fixtures) skips it
  // while the dedicated templates-e2e job always builds fixtures first.
  testIgnore: process.env.ZENITH_TEMPLATE_APPS ? undefined : /templates-matrix/,
  webServer: process.env.ZENITH_E2E_NO_SERVER
    ? undefined
    : {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://127.0.0.1:8089/e2e/fixture.html',
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
      },
});
