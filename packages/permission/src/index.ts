export {
  PermissionManager,
  createPermissionManager,
  getPermissionManager,
  clearPermissionManagers,
  createGuard,
  deepFreeze,
  requirePermission,
  requireRole,
  type PermissionState,
} from './permission';

export { processPermission, processRole } from './directive';
