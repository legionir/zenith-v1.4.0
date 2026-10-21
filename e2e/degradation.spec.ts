// #95 — graceful-degradation matrix in a REAL browser: every degraded mode
// boots with ZERO unhandled exceptions/rejections, storage degrades to memory
// per contract, a missing/blocked SW never blocks boot, and without JS the
// page shows usable <noscript> content instead of a blank page.
// Expected behavior per mode is defined in e2e/degradation-fixture.html.
import { test, expect, type Page } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

type DegradeReport = {
  storage: {
    default: { driver: string; writeOk: boolean; readOk: boolean };
    indexeddb: { driver: string; writeOk: boolean; readOk: boolean };
  };
  sw: string | null;
};

async function loadFixture(page: Page, url: string) {
  const diags = attachDiags(page);
  await page.goto(url);
  await waitReady(page, '__ZENITH_DEGRADE_READY__', diags);
  const report = await page.evaluate(
    () => (window as unknown as { __ZENITH_DEGRADE__: DegradeReport }).__ZENITH_DEGRADE__,
  );
  return { diags, report };
}

test('default mode: local storage works and the SW registers', async ({ page }) => {
  const { diags, report } = await loadFixture(page, '/e2e/degradation-fixture.html');
  expect(report.storage.default.driver).toBe('local');
  expect(report.storage.default.writeOk).toBe(true);
  expect(report.storage.default.readOk).toBe(true);
  expect(report.storage.indexeddb.readOk).toBe(true);
  expect(report.sw?.startsWith('registered:')).toBe(true);
  expect(diags.pageErrors).toEqual([]);
});

test('blocked SW never blocks boot', async ({ page }) => {
  await page.route('**/degradation-sw.js', (route) => route.abort('blockedbyclient'));
  const { diags, report } = await loadFixture(page, '/e2e/degradation-fixture.html');
  expect(report.sw?.startsWith('failed:')).toBe(true);
  expect(report.storage.default.readOk).toBe(true);
  expect(await page.locator('#app').textContent()).toContain('boot ok');
  expect(diags.pageErrors).toEqual([]);
});

test('missing IndexedDB falls back to memory storage', async ({ page }) => {
  // Capabilities are blocked BEFORE any page code runs (acceptance).
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).indexedDB;
  });
  const { diags, report } = await loadFixture(page, '/e2e/degradation-fixture.html');
  expect(report.storage.indexeddb.driver).toBe('memory');
  expect(report.storage.indexeddb.writeOk).toBe(true);
  expect(report.storage.indexeddb.readOk).toBe(true);
  // The default (local) driver is unaffected by the IDB outage.
  expect(report.storage.default.driver).toBe('local');
  expect(report.storage.default.readOk).toBe(true);
  expect(diags.pageErrors).toEqual([]);
});

test('throwing web storage falls back to memory storage', async ({ page }) => {
  await page.addInitScript(() => {
    const bomb = () => {
      throw new DOMException('storage denied', 'SecurityError');
    };
    for (const key of ['localStorage', 'sessionStorage'] as const) {
      Object.defineProperty(window, key, { configurable: true, get: bomb });
    }
  });
  const { diags, report } = await loadFixture(page, '/e2e/degradation-fixture.html');
  expect(report.storage.default.driver).toBe('memory');
  expect(report.storage.default.writeOk).toBe(true);
  expect(report.storage.default.readOk).toBe(true);
  expect(diags.pageErrors).toEqual([]);
});

test('quota errors never throw: the write is dropped with a warning, boot continues', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const real = window.localStorage;
    const quotaErr = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };
    // Pass the driver's availability probe (which uses __zenith_probe__) but
    // fail every real key — this exercises the write-time quota path, not
    // the construction-time fallback.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () =>
        new Proxy(real, {
          get: (target, prop) => {
            if (prop === 'setItem') {
              return (k: string, v: string) =>
                k === '__zenith_probe__' ? target.setItem(k, v) : quotaErr();
            }
            const value = target[prop as keyof Storage];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }),
    });
  });
  const { diags, report } = await loadFixture(page, '/e2e/degradation-fixture.html');
  expect(report.storage.default.driver).toBe('local');
  expect(report.storage.default.writeOk).toBe(true); // set() did not throw
  expect(report.storage.default.readOk).toBe(false); // the write was dropped, honestly reported
  expect(diags.pageErrors).toEqual([]);
});

test('without JS the page shows usable content, not a blank page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/e2e/degradation-fixture.html');
    await expect(page.locator('#noscript')).toBeVisible();
    const text = ((await page.locator('body').textContent()) ?? '').trim();
    expect(text.length).toBeGreaterThan(200);
    expect(await page.locator('#noscript a').count()).toBeGreaterThanOrEqual(2);
  } finally {
    await context.close();
  }
});
