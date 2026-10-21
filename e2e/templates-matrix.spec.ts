// #33 — template matrix in REAL browsers: every scaffolded kind (built by
// `scripts/build-template-fixtures.mjs` from the real `create-zenith` CLI,
// installed from this-SHA tarballs) boots its production server and runs its
// counter flow with zero page/console errors. PWA additionally proves SW
// registration, offline boot and the update mechanism; SSR proves the
// production node server + hydration.
//
// Fixtures live in `$ZENITH_TEMPLATE_APPS` (default `e2e/template-apps`,
// gitignored). Missing fixtures fail closed — run the builder first. The main
// e2e job skips this file unless the env var is set (see playwright.config.ts);
// the dedicated `templates-e2e` CI job always builds fixtures first.
// Needs built dists + the builder output → validation phase.
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { attachDiags } from './helpers';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

const APPS = resolve(process.cwd(), process.env.ZENITH_TEMPLATE_APPS ?? join('e2e', 'template-apps'));
const PORTS: Record<string, number> = { spa: 8091, ssr: 8092, pwa: 8093, dashboard: 8094, minimal: 8095 };
const FIXTURE_NAMES: Record<string, string> = {
  spa: 'zenith-spa-fixture',
  ssr: 'zenith-ssr-fixture',
  pwa: 'zenith-pwa-fixture',
  dashboard: 'zenith-dashboard-fixture',
  minimal: 'zenith-minimal-fixture',
};

function fixtureDir(kind: string): string {
  const dir = join(APPS, kind);
  if (!existsSync(join(dir, 'package.json')) || !existsSync(join(dir, 'dist', 'index.html'))) {
    throw new Error(
      `template fixture "${kind}" missing in ${APPS} — run \`node scripts/build-template-fixtures.mjs --out ${APPS}\` first`,
    );
  }
  return dir;
}

async function waitForPort(port: number): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      await res.arrayBuffer().catch(() => null);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`server on port ${port} never came up`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const servers: ChildProcess[] = [];

async function startServer(kind: string): Promise<string> {
  const dir = fixtureDir(kind);
  const port = PORTS[kind]!;
  const isSsr = kind === 'ssr';
  const child = spawn('npm', isSsr ? ['start'] : ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
  });
  servers.push(child);
  await waitForPort(port);
  return `http://127.0.0.1:${port}/`;
}

test.beforeAll(async () => {
  for (const kind of Object.keys(PORTS)) await startServer(kind);
});

test.afterAll(async () => {
  await Promise.all(
    servers.map(
      (child) =>
        new Promise<void>((resolveDone) => {
          child.once('exit', () => resolveDone());
          child.kill('SIGTERM');
          setTimeout(() => {
            child.kill('SIGKILL');
            resolveDone();
          }, 8000).unref();
        }),
    ),
  );
  servers.length = 0;
});

async function expectCounterFlow(page, url: string) {
  const diags = attachDiags(page);
  await page.goto(url);
  const counter = page.locator('#app .counter span');
  await expect(counter).toHaveText('0', { timeout: 15_000 });
  await page.locator('#app button').first().click();
  await expect(counter).toHaveText('1', { timeout: 10_000 });
  await page.locator('#app button').nth(1).click();
  await expect(counter).toHaveText('0', { timeout: 10_000 });
  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
  return diags;
}

test('spa template boots its preview build and runs the counter', async ({ page }) => {
  await expectCounterFlow(page, `http://127.0.0.1:${PORTS.spa}/`);
});

test('dashboard template boots with its summary nav and runs the counter', async ({ page }) => {
  const diags = await expectCounterFlow(page, `http://127.0.0.1:${PORTS.dashboard}/`);
  await expect(page.locator('nav[aria-label="Dashboard"]')).toBeVisible();
  expect(diags.pageErrors).toEqual([]);
});

test('minimal template boots and renders its message', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto(`http://127.0.0.1:${PORTS.minimal}/`);
  await expect(page.locator('#app h1')).toHaveText('Hello Zenith', { timeout: 15_000 });
  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
});

test('ssr template serves rendered HTML from node and hydrates', async ({ page }) => {
  const diags = attachDiags(page);
  // Server-rendered HTML (no JS yet) already carries the app shell.
  const raw = await fetch(`http://127.0.0.1:${PORTS.ssr}/`).then((r) => r.text());
  expect(raw).toContain('zenith-ssr-fixture');
  await expectCounterFlow(page, `http://127.0.0.1:${PORTS.ssr}/`);
  expect(diags.pageErrors).toEqual([]);
});

test('pwa template registers its service worker and serves a manifest', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto(`http://127.0.0.1:${PORTS.pwa}/`);
  await expect(page.locator('#app .counter span')).toHaveText('0', { timeout: 15_000 });
  const scope = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((reg) => reg.scope).catch(() => null),
  );
  expect(scope).toContain(`127.0.0.1:${PORTS.pwa}`);
  const manifest = await page.evaluate(() =>
    fetch('/manifest.json').then((r) => r.json()).catch(() => null),
  );
  expect(manifest?.display).toBe('standalone');
  expect(diags.pageErrors).toEqual([]);
});

test('pwa template boots offline from cache and applies an sw update', async ({ page, context }) => {
  const diags = attachDiags(page);
  await page.goto(`http://127.0.0.1:${PORTS.pwa}/`);
  await expect(page.locator('#app .counter span')).toHaveText('0', { timeout: 15_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Offline reload: the cached app shell must still boot the counter.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#app .counter span')).toHaveText('0', { timeout: 15_000 });
  await context.setOffline(false);
  // Update: ship a new CACHE_VERSION in the served worker and prove the
  // browser installs it (old caches are purged on activate by the worker).
  const swPath = join(fixtureDir('pwa'), 'dist', 'sw.js');
  const before = readFileSync(swPath, 'utf8');
  expect(before).toContain("CACHE_VERSION = 'v1'");
  writeFileSync(swPath, before.replace("CACHE_VERSION = 'v1'", "CACHE_VERSION = 'v2'"));
  await page.reload();
  await page.waitForFunction(
    async () => (await caches.keys()).some((k) => k.includes('-v2')),
    { timeout: 30_000 },
  );
  expect(diags.pageErrors).toEqual([]);
});
