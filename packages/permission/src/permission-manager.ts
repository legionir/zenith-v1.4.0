// packages/permission/src/permission-manager.ts
//
// کلاس PermissionManager — استخراج مکانیکی از permission.ts،
// بدون تغییر رفتار (#40).

import { signal, computed, type Signal, type ReadonlySignal } from '@zenith/state';
import { logger } from '@zenith/logger';
import { deepFreeze, type PermissionState } from './permission-foundation';


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
  // server-side — see logger.info below.)
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
   * setUserAccess() and clear() become no-ops (with a logger.error). Use
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
      logger.error(
        '[Zenith Permission] PermissionManager is frozen — refusing to mutate user access. Call thaw() or create a new manager if you genuinely need to change permissions.',
      );
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
      logger.error(
        '[Zenith Permission] PermissionManager is frozen — refusing to clear user access.',
      );
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
    return roles.some((r) => state.roles.includes(r));
  }

  /**
   * بررسی اینکه آیا کاربر همه‌ی role ها را دارد.
   */
  hasAllRoles(roles: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return roles.every((r) => state.roles.includes(r));
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
   * #135: سیگنال واکنش‌گرا (`ReadonlySignal<boolean>`) برای بررسی مجوز `permission`.
   */
  canSignal(permission: string): ReadonlySignal<boolean> {
    return computed(() => this.checkPermission(permission));
  }

  /**
   * #135: سیگنال واکنش‌گرا (`ReadonlySignal<boolean>`) برای بررسی نقش `role`.
   */
  hasRoleSignal(role: string): ReadonlySignal<boolean> {
    return computed(() => this.checkRole(role));
  }

  /**
   * بررسی اینکه آیا کاربر حداقل یکی از permission ها را دارد.
   */
  canAny(permissions: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return permissions.some((p) => state.permissions.includes(p));
  }

  /**
   * بررسی اینکه آیا کاربر همه‌ی permission ها را دارد.
   */
  canAll(permissions: string[]): boolean {
    const state = this._signal.get();
    if (state.isSuperAdmin) return true;
    return permissions.every((p) => state.permissions.includes(p));
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
      const perms = (anyParen[1] ?? '').split(',').map((s) => s.trim());
      return this.canAny(perms);
    }
    const allParen = /^all\((.+)\)$/.exec(trimmed);
    if (allParen) {
      const perms = (allParen[1] ?? '').split(',').map((s) => s.trim());
      return this.canAll(perms);
    }

    // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback. To avoid
    // the `any:thing` collision, only treat `any:`/`all:` as a combinator
    // when the remainder (after the prefix) contains a comma OR when it is a
    // single token that does not itself look like a `name:scope` permission.
    // Either way, warn that this syntax is deprecated.
    if (/^any:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const perms = rest.split(',').map((s) => s.trim());
      if (perms.length > 1 || !rest.includes(':')) {
        logger.warn(
          `[Zenith Permission] \`any:\` prefix is deprecated and collides with permission names like \`any:thing\`. Use \`any(...)\` syntax instead. Expression: ${expr}`,
        );
        return this.canAny(perms);
      }
    }
    if (/^all:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const perms = rest.split(',').map((s) => s.trim());
      if (perms.length > 1 || !rest.includes(':')) {
        logger.warn(
          `[Zenith Permission] \`all:\` prefix is deprecated and collides with permission names like \`all:thing\`. Use \`all(...)\` syntax instead. Expression: ${expr}`,
        );
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
      const roles = (anyParen[1] ?? '').split(',').map((s) => s.trim());
      return this.hasAnyRole(roles);
    }
    const allParen = /^all\((.+)\)$/.exec(trimmed);
    if (allParen) {
      const roles = (allParen[1] ?? '').split(',').map((s) => s.trim());
      return this.hasAllRoles(roles);
    }

    // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback (same
    // collision-avoidance logic as checkPermission).
    if (/^any:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const roles = rest.split(',').map((s) => s.trim());
      if (roles.length > 1 || !rest.includes(':')) {
        logger.warn(
          `[Zenith Permission] \`any:\` prefix is deprecated; use \`any(...)\` syntax. Expression: ${expr}`,
        );
        return this.hasAnyRole(roles);
      }
    }
    if (/^all:/.test(trimmed)) {
      const rest = trimmed.slice(4);
      const roles = rest.split(',').map((s) => s.trim());
      if (roles.length > 1 || !rest.includes(':')) {
        logger.warn(
          `[Zenith Permission] \`all:\` prefix is deprecated; use \`all(...)\` syntax. Expression: ${expr}`,
        );
        return this.hasAllRoles(roles);
      }
    }

    return this.hasRole(trimmed);
  }
}
