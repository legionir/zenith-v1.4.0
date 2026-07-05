// packages/permission/src/permission.ts
//
// @zenith/permission — Authorization Runtime (Phase 4).
//
// این پکیج مدیریت authorization را فراهم می‌کند:
//   - Role-based access control (RBAC)
//   - Permission-based access control
//   - دایرکتیو zen-permission برای conditional rendering
//   - دایرکتیو zen-role برای conditional rendering
//   - Guard functions برای route protection
//   - Integration با @zenith/auth
//
// ── سینتکس ─ـ
//
//   <!-- Permission-based -->
//   <button zen-permission="users:delete" zen-action="crudDelete">Delete</button>
//   <div zen-permission="any:users:edit,users:create">Edit or Create</div>
//   <div zen-permission="all:users:edit,users:create">Edit AND Create</div>
//
//   <!-- Role-based -->
//   <div zen-role="admin">Admin Panel</div>
//   <div zen-role="any:admin,editor">Editor Section</div>
//   <div zen-role="all:admin,verified">Verified Admin</div>
//
//   <!-- اگر دسترسی نداشت، fallback نمایش داده می‌شود -->
//   <div zen-permission="admin:access">
//     <p>Admin content</p>
//     <template zen-fallback>
//       <p>Access denied</p>
//     </template>
//   </div>

import { signal, type Signal } from '@zenith/state';

/**
 * Deep-freeze an object and all its nested properties. Used by
 * PermissionManager.freeze() (BUG-PRM-01) to make the permission state
 * immutable at the JS engine level as a second line of defence after
 * the `_frozen` boolean flag.
 *
 * @param obj Any object to freeze.
 * @returns The same reference, now deeply frozen.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  const propNames = Reflect.ownKeys(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * وضعیت Permission.
 */
export interface PermissionState {
  /** Role های کاربر فعلی. */
  roles: string[];
  /** Permission های کاربر فعلی. */
  permissions: string[];
  /** آیا کاربر super-admin است (همه دسترسی‌ها)? */
  isSuperAdmin: boolean;
}

/**
 * کلاس Permission — مدیریت authorization.
 */
export class PermissionManager {
  private _signal: Signal<PermissionState>;
  private _superAdminRole: string;
  // SEC FIX (v1.2.6): SEC-A7 — once frozen, setUserAccess/clear are no-ops.
  // This lets application code pin the client-side permission state after
  // initial hydration so a later XSS or stray import cannot tamper with it
  // to escalate privileges in the UI. (Real authorization must still happen
  // server-side — see console.info below.)
  private _frozen = false;

  constructor(config: { superAdminRole?: string } = {}) {
    this._superAdminRole = config.superAdminRole || 'super-admin';
    this._signal = signal<PermissionState>({
      roles: [],
      permissions: [],
      isSuperAdmin: false,
    });
  }

  /** دریافت Signal وضعیت. */
  get signal(): Signal<PermissionState> {
    return this._signal;
  }

  /**
   * SEC FIX (v1.2.6): SEC-A7 — Freeze the manager. After this is called,
   * setUserAccess() and clear() become no-ops (with a console.error). Use
   * this once your client-side permission state has been hydrated from the
   * server to prevent later mutations (e.g. by a follow-up XSS payload).
   *
   * BUG-PRM-01 (v1.3.0): Also deep-freezes the current state with
   * Object.freeze() so that even if the `_frozen` flag is bypassed
   * (e.g. via prototype pollution or reflect tricks), the permission
   * array itself is immutable and throws in strict mode on mutation.
   *
   * Returns the manager for chaining.
   */
  freeze(): this {
    this._frozen = true;
    // BUG-PRM-01: deep-freeze the current state as a second line of defence.
    // When the state is frozen, mutations throw in strict mode and silently
    // fail in sloppy mode — either way the in-memory permission set cannot
    // be enlarged by a bypass that jumps over the _frozen flag check.
    deepFreeze(this._signal.get());
    return this;
  }

  /**
   * تنظیم roles و permissions کاربر.
   */
  setUserAccess(roles: string[], permissions: string[] = []): void {
    // SEC FIX (v1.2.6): SEC-A7 — deny mutations after freeze().
    if (this._frozen) {
      console.error('[Zenith Permission] PermissionManager is frozen — refusing to mutate user access. Call thaw() or create a new manager if you genuinely need to change permissions.');
      return;
    }
    this._signal.set({
      roles,
      permissions,
      isSuperAdmin: roles.includes(this._superAdminRole),
    });
  }

  /**
   * پاک کردن دسترسی‌ها (مثلاً بعد از logout).
   */
  clear(): void {
    // SEC FIX (v1.2.6): SEC-A7 — deny mutations after freeze().
    if (this._frozen) {
      console.error('[Zenith Permission] PermissionManager is frozen — refusing to clear user access.');
      return;
    }
    this._signal.set({
      roles: [],
      permissions: [],
      isSuperAdmin: false,
    });
  }

  /**
   * بررسی اینکه آیا کاربر یک role دارد.
   */
  hasRole(role: string): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return state.roles.includes(role);
  }

  /**
   * بررسی اینکه آیا کاربر حداقل یکی از role ها را دارد.
   */
  hasAnyRole(roles: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return roles.some(r => state.roles.includes(r));
  }

  /**
   * بررسی اینکه آیا کاربر همه‌ی role ها را دارد.
   */
  hasAllRoles(roles: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return roles.every(r => state.roles.includes(r));
  }

  /**
   * بررسی اینکه آیا کاربر یک permission دارد.
   */
  can(permission: string): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return state.permissions.includes(permission);
  }

  /**
   * بررسی اینکه آیا کاربر حداقل یکی از permission ها را دارد.
   */
  canAny(permissions: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return permissions.some(p => state.permissions.includes(p));
  }

  /**
   * بررسی اینکه آیا کاربر همه‌ی permission ها را دارد.
   */
  canAll(permissions: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return permissions.every(p => state.permissions.includes(p));
  }

  /**
   * بررسی یک expression دسترسی.
   *
   * سینتکس:
   *   "users:delete"           → can('users:delete')
   *   "any(users:edit,users:create)" → canAny(['users:edit', 'users:create'])  (preferred, v1.2.6)
   *   "all(users:edit,users:create)" → canAll(['users:edit', 'users:create'])  (preferred, v1.2.6)
   *   "any:users:edit,users:create"  → canAny (deprecated, kept for backward compat)
   *   "all:users:edit,users:create"  → canAll (deprecated, kept for backward compat)
   *
   * SEC FIX (v1.2.6): SEC-A6 — the legacy `any:`/`all:` prefix collided with
   * legitimate permission names like `any:thing` (which would be parsed as
   * `canAny(['thing'])` instead of `can('any:thing')`). The new preferred
   * syntax is `any(...)` / `all(...)` (parenthesised) which cannot collide.
   * The old syntax is still accepted but logs a deprecation warning.
   *
   * @param expr Expression دسترسی.
   * @returns true اگر دسترسی دارد.
   */
  checkPermission(expr: string): boolean {
    const trimmed = expr.trim();

    // SEC FIX (v1.2.6): SEC-A6 — preferred `any(...)` / `all(...)` syntax.
    const anyParen = /^any\((.+)\)$/.exec(trimmed);
    if (anyParen) {
      const perms = anyParen[1].split(',').map(s => s.trim());
      return this.canAny(perms);
    }
    const allParen = /^all\((.+)\)$/.exec(trimmed);
    if (allParen) {
      const perms = allParen[1].split(',').map(s => s.trim());
      return this.canAll(perms);
    }

    // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback. To avoid
    // the `any:thing` collision, only treat `any:`/`all:` as a combinator
    // when the remainder (after the prefix) contains a comma OR when it is a
    // single token that does not itself look like a `name:scope` permission.
    // Either way, warn that this syntax is deprecated.
    if (/^any:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const perms = rest.split(',').map(s => s.trim());
      if (perms.length > 1 || !rest.includes(':')) {
        console.warn('[Zenith Permission] `any:` prefix is deprecated and collides with permission names like `any:thing`. Use `any(...)` syntax instead. Expression:', expr);
        return this.canAny(perms);
      }
    }
    if (/^all:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const perms = rest.split(',').map(s => s.trim());
      if (perms.length > 1 || !rest.includes(':')) {
        console.warn('[Zenith Permission] `all:` prefix is deprecated and collides with permission names like `all:thing`. Use `all(...)` syntax instead. Expression:', expr);
        return this.canAll(perms);
      }
    }

    return this.can(trimmed);
  }

  /**
   * بررسی یک expression role.
   *
   * سینتکس:
   *   "admin"           → hasRole('admin')
   *   "any(admin,editor)" → hasAnyRole(['admin', 'editor'])  (preferred, v1.2.6)
   *   "all(admin,verified)" → hasAllRoles(['admin', 'verified'])  (preferred, v1.2.6)
   *   "any:admin,editor" → hasAnyRole (deprecated)
   *   "all:admin,verified" → hasAllRoles (deprecated)
   *
   * SEC FIX (v1.2.6): SEC-A6 — see checkPermission() for rationale.
   *
   * @param expr Expression role.
   * @returns true اگر دسترسی دارد.
   */
  checkRole(expr: string): boolean {
    const trimmed = expr.trim();

    // SEC FIX (v1.2.6): SEC-A6 — preferred `any(...)` / `all(...)` syntax.
    const anyParen = /^any\((.+)\)$/.exec(trimmed);
    if (anyParen) {
      const roles = anyParen[1].split(',').map(s => s.trim());
      return this.hasAnyRole(roles);
    }
    const allParen = /^all\((.+)\)$/.exec(trimmed);
    if (allParen) {
      const roles = allParen[1].split(',').map(s => s.trim());
      return this.hasAllRoles(roles);
    }

    // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback (same
    // collision-avoidance logic as checkPermission).
    if (/^any:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const roles = rest.split(',').map(s => s.trim());
      if (roles.length > 1 || !rest.includes(':')) {
        console.warn('[Zenith Permission] `any:` prefix is deprecated; use `any(...)` syntax. Expression:', expr);
        return this.hasAnyRole(roles);
      }
    }
    if (/^all:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const roles = rest.split(',').map(s => s.trim());
      if (roles.length > 1 || !rest.includes(':')) {
        console.warn('[Zenith Permission] `all:` prefix is deprecated; use `all(...)` syntax. Expression:', expr);
        return this.hasAllRoles(roles);
      }
    }

    return this.hasRole(trimmed);
  }
}

/**
 * Registry از PermissionManager instances.
 */
const permissionRegistry = new Map<string, PermissionManager>();

/**
 * ساخت یک PermissionManager.
 */
export function createPermissionManager(
  name: string = 'default',
  config?: { superAdminRole?: string },
): PermissionManager {
  // SEC FIX (v1.2.6): SEC-A7 — surface the trust boundary loudly. Client-side
  // permission checks only hide/show UI; they are trivially bypassable by an
  // attacker who can run JS in the page (XSS) or who simply edits the local
  // signal. Real authorization MUST happen on the server.
  console.info('[Zenith Permission] Client-side permissions are for UI only — always enforce server-side.');
  const manager = new PermissionManager(config);
  permissionRegistry.set(name, manager);
  return manager;
}

/**
 * دریافت PermissionManager با نام.
 */
export function getPermissionManager(name: string = 'default'): PermissionManager | undefined {
  return permissionRegistry.get(name);
}

/**
 * پاکسازی همه‌ی PermissionManager instances (برای تست‌ها).
 */
export function clearPermissionManagers(): void {
  permissionRegistry.clear();
}

/**
 * IMP-PRM-03 (v1.3.0): Route guard factory for router integration.
 *
 * Returns a NavigationGuard-compatible function that checks the current
 * PermissionManager for the required permission. If the user lacks access,
 * the guard redirects to `/unauthorized` (or a custom fallback path).
 *
 * Usage with @zenith/router's beforeEach():
 *
 *   import { requirePermission } from '@zenith/permission';
 *   import { beforeEach } from '@zenith/router';
 *
 *   beforeEach(requirePermission('admin:access'));
 *   beforeEach(requirePermission('any(users:edit,users:create)'));
 *
 * @param permission The permission expression to check.
 * @param redirectTo The fallback path when access is denied (default: '/unauthorized').
 * @returns Navigation guard function: (to, from) => true | string.
 */
export function requirePermission(
  permission: string,
  redirectTo = '/unauthorized',
): (to: string, from: string) => true | string {
  return (_to: string, _from: string): true | string => {
    const manager = getPermissionManager();
    if (!manager) {
      console.error('[Zenith Permission] No PermissionManager registered — requirePermission denies access.');
      return redirectTo;
    }
    try {
      if (manager.checkPermission(permission)) {
        return true;
      }
    } catch {
      // Fail-closed on unexpected errors
      console.error('[Zenith Permission] Unexpected error checking permission — denying access.');
      return redirectTo;
    }
    return redirectTo;
  };
}

/**
 * IMP-PRM-03 (v1.3.0): Route guard factory for role-based checks.
 *
 * Usage:
 *
 *   import { requireRole } from '@zenith/permission';
 *   import { beforeEach } from '@zenith/router';
 *
 *   beforeEach(requireRole('admin'));
 *
 * @param role The role expression to check (e.g. 'admin', 'any(admin,editor)').
 * @param redirectTo The fallback path when access is denied (default: '/unauthorized').
 * @returns Navigation guard function: (to, from) => true | string.
 */
export function requireRole(
  role: string,
  redirectTo = '/unauthorized',
): (to: string, from: string) => true | string {
  return (_to: string, _from: string): true | string => {
    const manager = getPermissionManager();
    if (!manager) {
      console.error('[Zenith Permission] No PermissionManager registered — requireRole denies access.');
      return redirectTo;
    }
    try {
      if (manager.checkRole(role)) {
        return true;
      }
    } catch {
      console.error('[Zenith Permission] Unexpected error checking role — denying access.');
      return redirectTo;
    }
    return redirectTo;
  };
}

/**
 * Guard function برای route protection.
 *
 * استفاده:
 *   const guard = createPermissionGuard('admin');
 *   if (!guard()) { Zen.navigate('/login'); }
 *
 * @param permissionOrRole permission یا role مورد نیاز.
 * @param type 'permission' یا 'role'.
 * @returns تابع guard.
 */
export function createGuard(
  permissionOrRole: string,
  type: 'permission' | 'role' = 'permission',
  options: { failOpen?: boolean } = {},
): () => boolean {
  // SEC FIX (v1.2.6): SEC-A5 — fail-closed by default. Previously, when no
  // PermissionManager had been created (e.g. before auth bootstrapped), the
  // guard returned `true` and granted access to anyone. That is a foot-gun:
  // forgetting to call createPermissionManager() in a single code path would
  // silently disable every guard in the app. The default is now `false`
  // (deny). Callers that genuinely want the legacy fail-open behaviour can
  // pass `{ failOpen: true }`.
  const failOpen = options.failOpen === true;
  return () => {
    const manager = getPermissionManager();
    if (!manager) {
      if (failOpen) {
        // Explicit opt-in to legacy behaviour.
        return true;
      }
      console.error('[Zenith Permission] No PermissionManager registered — guard is denying access by default (fail-closed). Create a manager with createPermissionManager(), or pass { failOpen: true } to createGuard() to restore legacy fail-open behaviour.');
      return false;
    }

    try {
      if (type === 'permission') {
        return manager.checkPermission(permissionOrRole);
      } else {
        return manager.checkRole(permissionOrRole);
      }
    } catch {
      // BUG-PRM-03 (v1.3.0): Fail-closed برای خطاهای غیرمنتظره.
      // اگر checkPermission/checkRole throw کند (مثلاً به دلیل داده‌ی خراب
      // یا استثنای ناشناخته)، قبلاً خطا bubble می‌کرد و fail-closed را دور
      // می‌زد. حالا catch می‌کنیم و false برمی‌گردانیم تا دسترسی رد شود.
      if (!failOpen) {
        console.error('[Zenith Permission] Unexpected error in guard — denying access (fail-closed).');
      }
      return false;
    }
  };
}
