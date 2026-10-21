// packages/permission/src/permission-foundation.ts
//
// Foundation خالص @zenith/permission: deepFreeze و PermissionState.
// استخراج مکانیکی از permission.ts، بدون تغییر رفتار (#40).


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
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      !Object.isFrozen(value)
    ) {
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
