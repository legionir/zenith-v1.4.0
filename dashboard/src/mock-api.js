// dashboard/src/mock-api.js
// #113 — data-driven mock API for users/roles/session (dashboard demo).
// Same engine as the other fixtures (`@zenith/mock`, cf.
// demos/resource/mock-backend.mjs): deterministic seed data, real 401/403
// enforcement — the UI-hiding directives are NEVER the authorization; every
// privileged route re-checks the token + permission itself.
//
// Pure policy (permissionsForRole/can/findUser/tokenFor/...) is unit-tested
// in scripts/test/dashboard-rbac.test.mjs; the routes are exercised there
// too via server.handle() (in-process, no browser). The browser flows live
// in e2e/dashboard-rbac.spec.ts.
import { createMockServer, rest, respond } from '@zenith/mock';

/** Role → permissions. `users:delete` is admin-only; `stats:read` excludes viewer. */
export const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze(['users:read', 'users:delete', 'stats:read']),
  editor: Object.freeze(['users:read', 'stats:read']),
  viewer: Object.freeze(['users:read']),
});

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function can(role, permission) {
  return permissionsForRole(role).includes(permission);
}

const SEED_USERS = Object.freeze([
  Object.freeze({
    id: 1,
    username: 'admin',
    password: 'admin123',
    name: 'مدیر نمونه',
    email: 'admin@example.com',
    role: 'admin',
  }),
  Object.freeze({
    id: 2,
    username: 'editor',
    password: 'editor123',
    name: 'ویراستار نمونه',
    email: 'editor@example.com',
    role: 'editor',
  }),
  Object.freeze({
    id: 3,
    username: 'viewer',
    password: 'viewer123',
    name: 'بیننده نمونه',
    email: 'viewer@example.com',
    role: 'viewer',
  }),
]);

/** Fresh mutable copies (login compares passwords; demo-only plaintext — see README). */
export function seedUsers() {
  return SEED_USERS.map((u) => ({ ...u }));
}

/** Never leak password hashes/secrets through the API. */
export function publicUser(user) {
  const { password: _password, ...pub } = user;
  return pub;
}

/** Deterministic demo tokens (no crypto in the mock — see README). */
export function tokenFor(user) {
  return `token-${user.username}`;
}

export function userFromToken(users, token) {
  if (typeof token !== 'string' || !token.startsWith('token-')) return null;
  return users.find((u) => tokenFor(u) === token) ?? null;
}

function bearer(request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export const STATS_SEED = Object.freeze({ orders: 12, revenue: 480000 });

export function createDashboardBackend({ latency = 0 } = {}) {
  let users = seedUsers();
  const authUser = (request) => userFromToken(users, bearer(request));

  const server = createMockServer(
    [
      rest.post('/api/auth/login', async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const user = users.find(
          (u) => u.username === body?.username && u.password === body?.password,
        );
        if (!user) return respond({ status: 401, json: { error: 'invalid-credentials' } });
        return respond({ json: { token: tokenFor(user), user: publicUser(user) } });
      }),
      rest.post('/api/auth/logout', () => respond({ json: { ok: true } })),
      rest.get('/api/auth/session', ({ request }) => {
        const user = authUser(request);
        return user
          ? respond({ json: { user: publicUser(user) } })
          : respond({ status: 401, json: { error: 'unauthorized' } });
      }),
      rest.post('/api/auth/refresh', ({ request }) => {
        const user = authUser(request);
        return user
          ? respond({ json: { token: tokenFor(user) } })
          : respond({ status: 401, json: { error: 'unauthorized' } });
      }),
      rest.get('/api/users', ({ request }) => {
        if (!authUser(request)) return respond({ status: 401, json: { error: 'unauthorized' } });
        return respond({ json: users.map(publicUser) });
      }),
      rest.delete('/api/users/:id', ({ request, params }) => {
        const user = authUser(request);
        if (!user) return respond({ status: 401, json: { error: 'unauthorized' } });
        if (!can(user.role, 'users:delete')) {
          return respond({ status: 403, json: { error: 'forbidden' } });
        }
        const target = users.find((u) => String(u.id) === params.id);
        if (!target) return respond({ status: 404, json: { error: 'not-found' } });
        if (target.id === user.id) {
          return respond({ status: 403, json: { error: 'cannot-delete-self' } });
        }
        users = users.filter((u) => u.id !== target.id);
        return respond({ json: { ok: true, deleted: target.id } });
      }),
      rest.get('/api/admin/stats', ({ request }) => {
        const user = authUser(request);
        if (!user) return respond({ status: 401, json: { error: 'unauthorized' } });
        if (!can(user.role, 'stats:read')) {
          return respond({ status: 403, json: { error: 'forbidden' } });
        }
        return respond({ json: { users: users.length, ...STATS_SEED } });
      }),
    ],
    {
      baseURL: globalThis.location?.origin ?? 'http://localhost',
      latency,
      onUnhandledRequest: 'bypass',
      record: true,
    },
  );

  return {
    server,
    reset() {
      users = seedUsers();
      server.reset();
    },
    seed() {
      return users.map(publicUser);
    },
  };
}
