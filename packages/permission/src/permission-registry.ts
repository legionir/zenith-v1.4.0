// packages/permission/src/permission-registry.ts
//
// رجیستری PermissionManagerها و factoryها — استخراج مکانیکی از
// permission.ts، بدون تغییر رفتار (#40).

import { computed, type ReadonlySignal } from '@zenith/state';
import { logger } from '@zenith/logger';
import { deprecate, onGlobalReset } from '@zenith/errors';
import { createScopedRegistry } from '@zenith/shared';
import { PermissionManager } from './permission-manager';


/**
 * Registry از PermissionManager instances.
 */
const permissionRegistry = createScopedRegistry<PermissionManager>('permissions');

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
  logger.info(
    '[Zenith Permission] Client-side permissions are for UI only — always enforce server-side.',
  );
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

/** #118 / #135: ثبت PermissionManager در رجیستری با بازگشت Cleanup idempotent. */
export function registerPermissionManager(name: string, manager: PermissionManager): () => void {
  return permissionRegistry.register(name, manager);
}

/** #118 / #135: بررسی وجود PermissionManager در رجیستری (`hasX`). */
export function hasPermissionManager(name: string = 'default'): boolean {
  return permissionRegistry.has(name);
}

/** #118 / #135: فهرست نام تمام PermissionManagerهای ثبت‌شده (`listXs`). */
export function listPermissionManagers(): string[] {
  return Array.from(permissionRegistry.keys());
}

/** #118 / #135: حذف یک PermissionManager با نام از رجیستری (`unregisterX`). */
export function unregisterPermissionManager(name: string): boolean {
  return permissionRegistry.delete(name);
}

/** #135: تابع سطح بالای واکنش‌گرا برای بررسی دسترسی در رجیستری پیش‌فرض. */
export function can(permission: string, managerName: string = 'default'): ReadonlySignal<boolean> {
  return computed(() => {
    const mgr = permissionRegistry.get(managerName);
    return mgr ? mgr.checkPermission(permission) : false;
  });
}

/**
 * پاکسازی همه‌ی PermissionManager instances (برای تست‌ها).
 */
export function clearPermissionManagers(): void {
  deprecate('ZEN-DEPR-057', 'clearPermissionManagers', 'resetForTesting() (@zenith/testing)');
  clearPermissionManagersInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearPermissionManagersInternal(): void {
  permissionRegistry.clear();
}

/* @__PURE__ */ onGlobalReset(clearPermissionManagersInternal);
