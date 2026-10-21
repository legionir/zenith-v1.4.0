// #113 — RBAC tests for the dashboard mock API. The pure policy and every
// route are exercised IN-PROCESS via server.handle() (no browser, no fetch
// patching); the browser allow/deny flows live in e2e/dashboard-rbac.spec.ts
// (needs dist builds + the e2e server → validation phase).
import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSIONS,
  STATS_SEED,
  can,
  createDashboardBackend,
  permissionsForRole,
  publicUser,
  seedUsers,
  tokenFor,
  userFromToken,
} from '../../dashboard/src/mock-api.js';

function backend() {
  const api = createDashboardBackend();
  return api;
}

async function call(api, method, path, { token = null, body = undefined } = {}) {
  const init = { method, headers: {} };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await api.server.handle(
    new Request(`http://localhost${path}`, init),
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function loginAs(api, username, password) {
  return call(api, 'POST', '/api/auth/login', { body: { username, password } });
}

describe('#113 — RBAC policy (pure)', () => {
  it('fixes the role → permission matrix', () => {
    expect(permissionsForRole('admin')).toEqual(['users:read', 'users:delete', 'stats:read']);
    expect(permissionsForRole('editor')).toEqual(['users:read', 'stats:read']);
    expect(permissionsForRole('viewer')).toEqual(['users:read']);
    expect(permissionsForRole('ghost')).toEqual([]);
    expect(can('admin', 'users:delete')).toBe(true);
    expect(can('editor', 'users:delete')).toBe(false);
    expect(can('viewer', 'stats:read')).toBe(false);
    expect(ROLE_PERMISSIONS.admin).toContain('users:delete');
  });

  it('issues deterministic tokens and never leaks passwords', () => {
    const users = seedUsers();
    expect(tokenFor(users[0])).toBe('token-admin');
    expect(userFromToken(users, 'token-editor')?.username).toBe('editor');
    expect(userFromToken(users, 'nope')).toBeNull();
    expect(userFromToken(users, null)).toBeNull();
    expect(publicUser(users[0])).not.toHaveProperty('password');
    expect(publicUser(users[0])).toMatchObject({ username: 'admin', role: 'admin' });
  });
});

describe('#113 — auth routes', () => {
  it('logs in with seed credentials and rejects bad ones', async () => {
    const api = backend();
    const ok = await loginAs(api, 'admin', 'admin123');
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBe('token-admin');
    expect(ok.body.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(ok.body.user).not.toHaveProperty('password');
    expect((await loginAs(api, 'admin', 'wrong')).status).toBe(401);
    expect((await loginAs(api, 'ghost', 'x')).status).toBe(401);
  });

  it('guards session/refresh/logout by token', async () => {
    const api = backend();
    expect((await call(api, 'GET', '/api/auth/session')).status).toBe(401);
    expect((await call(api, 'POST', '/api/auth/refresh')).status).toBe(401);
    const { body } = await loginAs(api, 'viewer', 'viewer123');
    const session = await call(api, 'GET', '/api/auth/session', { token: body.token });
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ username: 'viewer' });
    const refreshed = await call(api, 'POST', '/api/auth/refresh', { token: body.token });
    expect(refreshed).toMatchObject({ status: 200, body: { token: 'token-viewer' } });
    expect((await call(api, 'POST', '/api/auth/logout', { token: body.token })).status).toBe(200);
  });
});

describe('#113 — users routes enforce RBAC server-side', () => {
  it('requires auth for the list and strips passwords', async () => {
    const api = backend();
    expect((await call(api, 'GET', '/api/users')).status).toBe(401);
    const { body } = await loginAs(api, 'viewer', 'viewer123');
    const list = await call(api, 'GET', '/api/users', { token: body.token });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(3);
    for (const u of list.body) expect(u).not.toHaveProperty('password');
  });

  it('lets admin delete, rejects viewer/editor with 403, 404s unknown ids', async () => {
    const api = backend();
    const admin = (await loginAs(api, 'admin', 'admin123')).body.token;
    const viewer = (await loginAs(api, 'viewer', 'viewer123')).body.token;
    const editor = (await loginAs(api, 'editor', 'editor123')).body.token;
    expect((await call(api, 'DELETE', '/api/users/3')).status).toBe(401);
    expect(await call(api, 'DELETE', '/api/users/3', { token: viewer })).toMatchObject({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(await call(api, 'DELETE', '/api/users/3', { token: editor })).toMatchObject({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(await call(api, 'DELETE', '/api/users/999', { token: admin })).toMatchObject({
      status: 404,
      body: { error: 'not-found' },
    });
    // Admin cannot delete their own account.
    expect(await call(api, 'DELETE', '/api/users/1', { token: admin })).toMatchObject({
      status: 403,
      body: { error: 'cannot-delete-self' },
    });
    const del = await call(api, 'DELETE', '/api/users/3', { token: admin });
    expect(del).toMatchObject({ status: 200, body: { ok: true, deleted: 3 } });
    const list = await call(api, 'GET', '/api/users', { token: admin });
    expect(list.body.map((u) => u.username).sort()).toEqual(['admin', 'editor']);
  });

  it('resets to the deterministic seed', async () => {
    const api = backend();
    const admin = (await loginAs(api, 'admin', 'admin123')).body.token;
    await call(api, 'DELETE', '/api/users/3', { token: admin });
    api.reset();
    const list = await call(api, 'GET', '/api/users', { token: admin });
    expect(list.body).toHaveLength(3);
  });
});

describe('#113 — stats route enforces stats:read', () => {
  it('serves admin/editor and rejects viewer/anonymous with 401/403', async () => {
    const api = backend();
    expect((await call(api, 'GET', '/api/admin/stats')).status).toBe(401);
    const admin = (await loginAs(api, 'admin', 'admin123')).body.token;
    const editor = (await loginAs(api, 'editor', 'editor123')).body.token;
    const viewer = (await loginAs(api, 'viewer', 'viewer123')).body.token;
    expect(await call(api, 'GET', '/api/admin/stats', { token: viewer })).toMatchObject({
      status: 403,
      body: { error: 'forbidden' },
    });
    for (const token of [admin, editor]) {
      const res = await call(api, 'GET', '/api/admin/stats', { token });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(STATS_SEED);
      expect(res.body.users).toBe(3);
    }
  });
});
