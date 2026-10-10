// Playwright config for the #79 browser-e2e CI stage.
// Scope: one smoke test that boots the real built ESM bundles in Chromium —
// proof that build output is consumable by a browser and the reactive
// pipeline updates the DOM. Full directive/hydration e2e lives in #28/#33.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8089',
    trace: 'retain-on-failure',
  },
  // Local sandbox override: use the preinstalled Chromium when PLAYWRIGHT_BROWSER_PATH
  // is set (CI leaves it unset and uses npx playwright install's browser).
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
    : [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:8089/e2e/fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
