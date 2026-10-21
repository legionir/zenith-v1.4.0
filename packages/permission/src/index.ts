/** @public */
export {
  PermissionManager,
  createPermissionManager,
  registerPermissionManager,
  getPermissionManager,
  hasPermissionManager,
  listPermissionManagers,
  unregisterPermissionManager,
  clearPermissionManagers,
  can,
  createGuard,
  deepFreeze,
  requirePermission,
  requireRole,
  type PermissionState,
} from './permission';

/** @public */
export { processPermission, processRole } from './directive';
