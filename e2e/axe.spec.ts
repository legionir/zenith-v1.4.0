// #99 — automated axe-core accessibility gate over the demos and the component fixtures.
// Fails on any serious/critical WCAG A/AA violation (see ./axe.ts and ./a11y-allowlist.ts).
import { test, expect } from '@playwright/test';
import { axeFindings, blockExternalRequests } from './axe';

/** [path, minimum rendered elements] — the minimum guards against a vacuous (blank page) pass */
const PAGES: ReadonlyArray<readonly [string, number]> = [
  ['/e2e/fixture.html', 3],
  ['/demos/index.html', 10],
  ['/demos/components/index.html', 10],
  ['/demos/virtual-list/index.html', 10],
  ['/demos/transition/index.html', 10],
  ['/demos/form/index.html', 10],
  ['/ecommerce-demo/index.html', 10],
  ['/dashboard/index.html', 10],
];

for (const [path, minElements] of PAGES) {
  test(`axe: no serious/critical violations — ${path}`, async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(500); // let module scripts render the initial UI
    // guard against a vacuous pass: the page must actually have rendered content
    expect(await page.locator('body *').count(), `${path} rendered nothing`).toBeGreaterThanOrEqual(
      minElements,
    );
    const findings = await axeFindings(page, path);
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });
}

// Acceptance (#99): a deliberate violation MUST break the gate — proves it cannot pass vacuously.
test('axe gate self-test: a deliberate violation is reported (button-name, image-alt)', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>x</title></head><body><main>' +
      '<button></button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>',
  );
  const findings = await axeFindings(page, '/self-test');
  expect(findings.map((f) => f.rule).sort()).toEqual(
    expect.arrayContaining(['button-name', 'image-alt']),
  );
});
