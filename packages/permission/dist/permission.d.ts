import { type Signal } from '@zenith/state';
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
export declare class PermissionManager {
    private _signal;
    private _superAdminRole;
    constructor(config?: {
        superAdminRole?: string;
    });
    /** دریافت Signal وضعیت. */
    get signal(): Signal<PermissionState>;
    /**
     * تنظیم roles و permissions کاربر.
     */
    setUserAccess(roles: string[], permissions?: string[]): void;
    /**
     * پاک کردن دسترسی‌ها (مثلاً بعد از logout).
     */
    clear(): void;
    /**
     * بررسی اینکه آیا کاربر یک role دارد.
     */
    hasRole(role: string): boolean;
    /**
     * بررسی اینکه آیا کاربر حداقل یکی از role ها را دارد.
     */
    hasAnyRole(roles: string[]): boolean;
    /**
     * بررسی اینکه آیا کاربر همه‌ی role ها را دارد.
     */
    hasAllRoles(roles: string[]): boolean;
    /**
     * بررسی اینکه آیا کاربر یک permission دارد.
     */
    can(permission: string): boolean;
    /**
     * بررسی اینکه آیا کاربر حداقل یکی از permission ها را دارد.
     */
    canAny(permissions: string[]): boolean;
    /**
     * بررسی اینکه آیا کاربر همه‌ی permission ها را دارد.
     */
    canAll(permissions: string[]): boolean;
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
    checkPermission(expr: string): boolean;
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
    checkRole(expr: string): boolean;
}
/**
 * ساخت یک PermissionManager.
 */
export declare function createPermissionManager(name?: string, config?: {
    superAdminRole?: string;
}): PermissionManager;
/**
 * دریافت PermissionManager با نام.
 */
export declare function getPermissionManager(name?: string): PermissionManager | undefined;
/**
 * پاکسازی همه‌ی PermissionManager instances (برای تست‌ها).
 */
export declare function clearPermissionManagers(): void;
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
export declare function createGuard(permissionOrRole: string, type?: 'permission' | 'role'): () => boolean;
