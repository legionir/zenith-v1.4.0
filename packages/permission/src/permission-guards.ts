// packages/permission/src/permission-guards.ts
//
// گاردهای مسیر (requirePermission/requireRole/createGuard) — استخراج
// مکانیکی از permission.ts، بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';
import { getPermissionManager } from './permission-registry';


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
      logger.error(
        '[Zenith Permission] No PermissionManager registered — requirePermission denies access.',
      );
      return redirectTo;
    }
    try {
      if (manager.checkPermission(permission)) {
        return true;
      }
    } catch {
      // Fail-closed on unexpected errors
      logger.error('[Zenith Permission] Unexpected error checking permission — denying access.');
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
      logger.error(
        '[Zenith Permission] No PermissionManager registered — requireRole denies access.',
      );
      return redirectTo;
    }
    try {
      if (manager.checkRole(role)) {
        return true;
      }
    } catch {
      logger.error('[Zenith Permission] Unexpected error checking role — denying access.');
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
      logger.error(
        '[Zenith Permission] No PermissionManager registered — guard is denying access by default (fail-closed). Create a manager with createPermissionManager(), or pass { failOpen: true } to createGuard() to restore legacy fail-open behaviour.',
      );
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
        logger.error(
          '[Zenith Permission] Unexpected error in guard — denying access (fail-closed).',
        );
      }
      return false;
    }
  };
}
