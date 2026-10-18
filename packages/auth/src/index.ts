export {
  Auth,
  createAuth,
  getDefaultAuth,
  registerAuth,
  getAuth,
  hasAuth,
  listAuths,
  unregisterAuth,
  clearAuth,
  authConfigOptions,
  AUTH_CONFIG_DEFAULTS,
  authConfigSchema,
  resolveAuthConfig,
  type AuthState,
  type AuthUser,
  type AuthConfig,
  type AuthEvent,
  type AuthEventListener,
} from './auth';

// FEATURE (v1.4.0): Functional Auth API
export {
  configureAuth,
  getAuthConfig,
  initAuth,
  login,
  logout,
  register,
  refreshToken,
  fetchCurrentUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  canActivateRoute,
  auth,
  functionalAuthConfigOptions,
  FUNCTIONAL_AUTH_CONFIG_DEFAULTS,
  functionalAuthConfigSchema,
  resolveFunctionalAuthConfig,
  type User,
  type AuthTokens,
  type FunctionalAuthState,
  type LoginCredentials,
  type RegisterData,
  type FunctionalAuthConfig,
  type RouteGuard,
} from './auth';

export {
  createAuthRegistry, authPlugin, getAppAuth, authPluginOptions,
  type AuthRegistry, type AuthRegistryStore, type AuthAppHost, type AuthPluginOptions,
} from './registry';

// Higher-layer ownership bridge; not an application configuration API.
export { setAuthRegistryOwner, type AuthRegistryOwner } from './auth';
