// #76 — the published browser bundle loads through <script integrity="sha384-…"> in real
// browsers, reports the same version as its directory, and a wrong hash is rejected.
import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    Zenith?: { version: string; createApp: unknown; signal: unknown };
  }
}

type Manifest = {
  version: string;
  pinned: boolean;
  files: Record<string, { integrity: string; bytes: number }>;
};

async function manifestOf(page: import('@playwright/test').Page, dir: string): Promise<Manifest> {
  return page.evaluate(
    async (d) => (await fetch(`/browser-bundles/${d}/integrity.json`)).json(),
    dir,
  );
}

function loadScript(page: import('@playwright/test').Page, src: string, integrity: string) {
  return page.evaluate(
    ({ src, integrity }) =>
      new Promise<'loaded' | 'blocked'>((resolve) => {
        const s = document.createElement('script');
        s.src = src;
        s.integrity = integrity;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve('loaded');
        s.onerror = () => resolve('blocked');
        document.head.appendChild(s);
      }),
    { src, integrity },
  );
}

test('versioned bundle loads with a matching integrity hash and reports its version', async ({
  page,
}) => {
  await page.goto('/e2e/bundle-fixture.html');
  const latest = await manifestOf(page, 'latest');
  expect(latest.pinned, 'latest/ must not be advertised as pinnable').toBe(false);
  const m = await manifestOf(page, latest.version);
  expect(m.pinned).toBe(true);
  expect(m.version).toBe(latest.version);

  const result = await loadScript(
    page,
    `/browser-bundles/${m.version}/zenith.min.js`,
    m.files['zenith.min.js']!.integrity,
  );
  expect(result).toBe('loaded');
  const global = await page.evaluate(() => ({
    version: window.Zenith?.version,
    createApp: typeof window.Zenith?.createApp,
    signal: typeof window.Zenith?.signal,
  }));
  expect(global).toEqual({ version: m.version, createApp: 'function', signal: 'function' });
});

test('a tampered / wrong integrity hash is rejected by the browser', async ({ page }) => {
  await page.goto('/e2e/bundle-fixture.html');
  const latest = await manifestOf(page, 'latest');
  const wrong = 'sha384-' + 'A'.repeat(64);
  const result = await loadScript(page, `/browser-bundles/${latest.version}/zenith.min.js`, wrong);
  expect(result).toBe('blocked');
  expect(await page.evaluate(() => typeof window.Zenith)).toBe('undefined');
});

test('sourcemap is a separate file referenced from the bundle', async ({ page, request }) => {
  await page.goto('/e2e/bundle-fixture.html');
  const latest = await manifestOf(page, 'latest');
  const base = `/browser-bundles/${latest.version}`;
  const js = await (await request.get(`${base}/zenith.min.js`)).text();
  expect(js.trimEnd().endsWith('//# sourceMappingURL=zenith.min.js.map')).toBe(true);
  const map = await (await request.get(`${base}/zenith.min.js.map`)).json();
  expect(map.version).toBe(3);
  expect(map.sources.length).toBeGreaterThan(10);
});
