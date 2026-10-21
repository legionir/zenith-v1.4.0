// dashboard/src/main.js
// #113 — dashboard boot: mock API + session store + permission manager +
// runtime actions. Pattern mirrors ecommerce-demo/src/main.js (plain JS,
// page importmap, no build pipeline). Only verified APIs are used:
// Zen.action/Zen.start (@zenith/runtime), defineStore (@zenith/store),
// createStorage (@zenith/storage), createPermissionManager/setUserAccess
// (@zenith/permission) and fetch against the mock backend.
import { Zen } from '@zenith/runtime';
import { defineStore } from '@zenith/store';
import { createStorage } from '@zenith/storage';
import { createPermissionManager } from '@zenith/permission';
import { createDashboardBackend, permissionsForRole } from './mock-api.js';

const backend = createDashboardBackend();
backend.server.listen();

const sessionStorage = createStorage({ namespace: 'dashboard' });
const permissionManager = createPermissionManager();

function applySession(user, token) {
  if (user && token) {
    sessionStorage.set('user', user);
    sessionStorage.set('token', token);
    permissionManager.setUserAccess([user.role], permissionsForRole(user.role));
  } else {
    sessionStorage.remove('user');
    sessionStorage.remove('token');
    permissionManager.setUserAccess([], []);
  }
}

async function api(path, token, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// Module-level loaders: store actions delegate here so no action depends on
// sibling-action dispatch semantics (only `this.state`, the proven pattern).
async function refreshUsers(store) {
  const { status, body } = await api('/api/users', store.state.token);
  if (status === 200) {
    store.state.users = body;
    store.state.error = null;
    return true;
  }
  store.state.users = [];
  store.state.error = status === 401 ? 'برای دیدن کاربران وارد شوید.' : 'دسترسی به کاربران ممکن نیست.';
  return false;
}

async function refreshStats(store) {
  const { status, body } = await api('/api/admin/stats', store.state.token);
  if (status === 200) {
    store.state.stats = body;
    return true;
  }
  store.state.stats = null;
  return false;
}

const useDashboard = defineStore('dashboard', {
  state: () => ({
    user: sessionStorage.get('user') ?? null,
    token: sessionStorage.get('token') ?? null,
    users: [],
    stats: null,
    error: null,
  }),
  actions: {
    async refreshUsers() {
      return refreshUsers(this);
    },
    async refreshStats() {
      return refreshStats(this);
    },
    async login(username, password) {
      const { status, body } = await api('/api/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (status !== 200) {
        this.state.error = 'نام کاربری یا رمز اشتباه است.';
        return false;
      }
      applySession(body.user, body.token);
      this.state.user = body.user;
      this.state.token = body.token;
      this.state.error = null;
      await refreshUsers(this);
      await refreshStats(this);
      return true;
    },
    async logout() {
      await api('/api/auth/logout', this.state.token, { method: 'POST' }).catch(() => {});
      applySession(null, null);
      this.state.user = null;
      this.state.token = null;
      this.state.users = [];
      this.state.stats = null;
      this.state.error = null;
    },
    async deleteUser(id) {
      const { status, body } = await api(`/api/users/${id}`, this.state.token, { method: 'DELETE' });
      if (status === 200) {
        await refreshUsers(this);
        await refreshStats(this);
        return true;
      }
      this.state.error =
        body?.error === 'forbidden' || body?.error === 'cannot-delete-self'
          ? 'اجازهٔ حذف این کاربر را ندارید.'
          : 'حذف کاربر ممکن نشد.';
      return false;
    },
  },
});

export const dashboard = useDashboard();

// Restore a previous session (permission manager + data follow the token).
if (dashboard.state.user && dashboard.state.token) {
  permissionManager.setUserAccess(
    [dashboard.state.user.role],
    permissionsForRole(dashboard.state.user.role),
  );
  void dashboard.refreshUsers();
  void dashboard.refreshStats();
} else {
  permissionManager.setUserAccess([], []);
}

Zen.action('login', () => {
  const username = document.getElementById('login-username')?.value ?? '';
  const password = document.getElementById('login-password')?.value ?? '';
  void dashboard.login(username, password);
});

Zen.action('authLogout', () => {
  void dashboard.logout();
});

Zen.action('deleteUser', ({ element }) => {
  const id = element.getAttribute('data-user-id') ?? '';
  if (id) void dashboard.deleteUser(id);
});

const mainEl = typeof document !== 'undefined' ? document.querySelector('main') : null;
if (mainEl) {
  Zen.start(mainEl, { dashboard });
}
