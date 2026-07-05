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
import { signal } from '@zenith/state';
/**
 * کلاس Permission — مدیریت authorization.
 */
export class PermissionManager {
    _signal;
    _superAdminRole;
    // SEC FIX (v1.2.6): SEC-A7 — once frozen, setUserAccess/clear are no-ops.
    _frozen = false;
    constructor(config = {}) {
        this._superAdminRole = config.superAdminRole || 'super-admin';
        this._signal = signal({
            roles: [],
            permissions: [],
            isSuperAdmin: false,
        });
    }
    /** دریافت Signal وضعیت. */
    get signal() {
        return this._signal;
    }
    /**
     * SEC FIX (v1.2.6): SEC-A7 — Freeze the manager. After this is called,
     * setUserAccess() and clear() become no-ops (with a console.error). Use
     * this once your client-side permission state has been hydrated from the
     * server to prevent later mutations.
     */
    freeze() {
        this._frozen = true;
        return this;
    }
    /**
     * تنظیم roles و permissions کاربر.
     */
    setUserAccess(roles, permissions = []) {
        // SEC FIX (v1.2.6): SEC-A7 — deny mutations after freeze().
        if (this._frozen) {
            console.error('[Zenith Permission] PermissionManager is frozen — refusing to mutate user access.');
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
    clear() {
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
    hasRole(role) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return state.roles.includes(role);
    }
    /**
     * بررسی اینکه آیا کاربر حداقل یکی از role ها را دارد.
     */
    hasAnyRole(roles) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return roles.some(r => state.roles.includes(r));
    }
    /**
     * بررسی اینکه آیا کاربر همه‌ی role ها را دارد.
     */
    hasAllRoles(roles) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return roles.every(r => state.roles.includes(r));
    }
    /**
     * بررسی اینکه آیا کاربر یک permission دارد.
     */
    can(permission) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return state.permissions.includes(permission);
    }
    /**
     * بررسی اینکه آیا کاربر حداقل یکی از permission ها را دارد.
     */
    canAny(permissions) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return permissions.some(p => state.permissions.includes(p));
    }
    /**
     * بررسی اینکه آیا کاربر همه‌ی permission ها را دارد.
     */
    canAll(permissions) {
        const state = this._signal.get();
        if (state.isSuperAdmin)
            return true;
        return permissions.every(p => state.permissions.includes(p));
    }
    /**
     * بررسی یک expression دسترسی.
     *
     * سینتکس:
     *   "users:delete"           → can('users:delete')
     *   "any:users:edit,users:create" → canAny(['users:edit', 'users:create'])
     *   "all:users:edit,users:create" → canAll(['users:edit', 'users:create'])
     *
     * @param expr Expression دسترسی.
     * @returns true اگر دسترسی دارد.
     */
    checkPermission(expr) {
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
        // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback. To
        // avoid the `any:thing` collision, only treat `any:`/`all:` as a
        // combinator when the remainder contains a comma OR is a single
        // token that doesn't itself look like a `name:scope` permission.
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
     *   "any:admin,editor" → hasAnyRole(['admin', 'editor'])
     *   "all:admin,verified" → hasAllRoles(['admin', 'verified'])
     *
     * @param expr Expression role.
     * @returns true اگر دسترسی دارد.
     */
    checkRole(expr) {
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
        // SEC FIX (v1.2.6): SEC-A6 — deprecated `any:`/`all:` fallback.
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
const permissionRegistry = new Map();
/**
 * ساخت یک PermissionManager.
 */
export function createPermissionManager(name = 'default', config) {
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
export function getPermissionManager(name = 'default') {
    return permissionRegistry.get(name);
}
/**
 * پاکسازی همه‌ی PermissionManager instances (برای تست‌ها).
 */
export function clearPermissionManagers() {
    permissionRegistry.clear();
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
export function createGuard(permissionOrRole, type = 'permission', options = {}) {
    // SEC FIX (v1.2.6): SEC-A5 — fail-closed by default. Previously, when no
    // PermissionManager had been created, the guard returned `true` and
    // granted access to anyone. The default is now `false` (deny). Callers
    // that genuinely want the legacy fail-open behaviour can pass
    // `{ failOpen: true }`.
    const failOpen = options.failOpen === true;
    return () => {
        const manager = getPermissionManager();
        if (!manager) {
            if (failOpen) {
                return true;
            }
            console.error('[Zenith Permission] No PermissionManager registered — guard is denying access by default (fail-closed). Pass { failOpen: true } to restore legacy fail-open behaviour.');
            return false;
        }
        if (type === 'permission') {
            return manager.checkPermission(permissionOrRole);
        }
        else {
            return manager.checkRole(permissionOrRole);
        }
    };
}
//# sourceMappingURL=permission.js.map