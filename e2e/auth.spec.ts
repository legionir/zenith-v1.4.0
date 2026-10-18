import { test, expect, type Page } from '@playwright/test';

type Fixture = {
  init(): Promise<void>; login(): Promise<boolean>; refresh(): Promise<boolean>; logout(): Promise<void>;
  dispose(): void; snapshot(): { token: string | null; authenticated: boolean };
};
type FixtureGlobal = typeof globalThis & { authFixture: Fixture };
async function ready(page: Page, query = '') {
  await page.goto(`/e2e/auth-fixture.html${query}`);
  await page.waitForFunction(() => !!(globalThis as FixtureGlobal).authFixture);
  await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.init());
}

test.beforeEach(async ({ context }) => {
  await context.route('**/e2e/auth-session/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    const user = { id: 'fixture', name: 'Fixture', email: 'fixture@example.test', roles: [], permissions: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(endpoint === 'me' ? user : {
      token: endpoint === 'refresh' ? 'rotated-browser-fixture' : 'initial-browser-fixture',
      refreshToken: 'refresh-browser-fixture', user, expiresIn: 3600,
    }) });
  });
});

test('real browser BroadcastChannel logs out a peer memory session', async ({ page, context }) => {
  const peer = await context.newPage();
  try {
    await ready(page); await ready(peer);
    expect(await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.login())).toBe(true);
    expect(await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.login())).toBe(true);
    await expect(peer.locator('#status')).toHaveText('signed-in');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.logout());
    await expect(peer.locator('#status')).toHaveText('signed-out');
    expect(await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot().token)).toBeNull();
  } finally { await peer.close(); }
});

test('native storage/channel refresh invalidation adopts the persisted peer token', async ({ page, context }) => {
  const peer = await context.newPage();
  try {
    await ready(page, '?persistent=true');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.login());
    await ready(peer, '?persistent=true'); await expect(peer.locator('#status')).toHaveText('signed-in');
    expect(await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.refresh())).toBe(true);
    await expect.poll(() => peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot().token))
      .toBe('rotated-browser-fixture');
    await expect(peer.locator('#status')).toHaveText('signed-in');
  } finally { await peer.close(); }
});

test('explicit scopes and App disposal stay isolated across browser tabs', async ({ page, context }) => {
  const peer = await context.newPage();
  try {
    await ready(page, '?scope=one'); await ready(peer, '?scope=two');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.login());
    await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.login());
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.logout());
    await expect(peer.locator('#status')).toHaveText('signed-in');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.dispose());
    await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.logout());
    await expect(page.locator('#status')).toHaveText('disposed');
  } finally { await peer.close(); }
});

test('native cross-tab storage fallback rotates and logs out without BroadcastChannel', async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined }); });
  const peer = await context.newPage();
  try {
    await ready(page, '?scope=storage-fallback&persistent=true');
    expect(await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.login())).toBe(true);
    await ready(peer, '?scope=storage-fallback&persistent=true'); await expect(peer.locator('#status')).toHaveText('signed-in');
    expect(await peer.evaluate(() => typeof BroadcastChannel)).toBe('undefined');
    expect(await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.refresh())).toBe(true);
    await expect.poll(() => peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot().token)).toBe('rotated-browser-fixture');
    await expect(peer.locator('#status')).toHaveText('signed-in');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.logout());
    await expect(peer.locator('#status')).toHaveText('signed-out');
    expect(await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot().token)).toBeNull();
  } finally { await peer.close(); }
});

test('a disposed persistent peer is not revived by a native storage refresh event', async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined }); });
  const peer = await context.newPage();
  try {
    await ready(page, '?scope=disposed-storage-peer&persistent=true');
    await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.login());
    await ready(peer, '?scope=disposed-storage-peer&persistent=true'); await expect(peer.locator('#status')).toHaveText('signed-in');
    await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.dispose());
    const before = await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot());
    // Wait for the real native event, not an arbitrary delay or synthetic dispatch.
    await peer.evaluate(() => {
      Reflect.set(globalThis, '__authStorageObserved', false);
      window.addEventListener('storage', () => { Reflect.set(globalThis, '__authStorageObserved', true); }, { once: true });
    });
    expect(await page.evaluate(() => (globalThis as FixtureGlobal).authFixture.refresh())).toBe(true);
    await peer.waitForFunction(() => Reflect.get(globalThis, '__authStorageObserved') === true);
    await expect(peer.locator('#status')).toHaveText('disposed');
    expect(await peer.evaluate(() => (globalThis as FixtureGlobal).authFixture.snapshot())).toEqual(before);
  } finally { await peer.close(); }
});
