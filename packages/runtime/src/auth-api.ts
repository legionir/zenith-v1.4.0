import * as standalone from '@zenith/auth';
import { installLegacyAuthOwnerBridge } from './auth-owner';

let installed = false;
function ensureOwner(): void {
  if (installed) return;
  installLegacyAuthOwnerBridge();
  installed = true;
}

/** Pure wrapper creation; ownership is attached only when the API is invoked. */
function owned<A extends unknown[], R>(operation: (...args: A) => R): (...args: A) => R {
  return (...args) => { ensureOwner(); return operation(...args); };
}

export const configureAuth = /* @__PURE__ */ owned(standalone.configureAuth);
export const initAuth = /* @__PURE__ */ owned(standalone.initAuth);
export const login = /* @__PURE__ */ owned(standalone.login);
export const logout = /* @__PURE__ */ owned(standalone.logout);
export const register = /* @__PURE__ */ owned(standalone.register);
export const refreshToken = /* @__PURE__ */ owned(standalone.refreshToken);
export const fetchCurrentUser = /* @__PURE__ */ owned(standalone.fetchCurrentUser);
export const hasRole = /* @__PURE__ */ owned(standalone.hasRole);
export const hasAnyRole = /* @__PURE__ */ owned(standalone.hasAnyRole);
export const hasAllRoles = /* @__PURE__ */ owned(standalone.hasAllRoles);
export const hasPermission = /* @__PURE__ */ owned(standalone.hasPermission);
export const hasAnyPermission = /* @__PURE__ */ owned(standalone.hasAnyPermission);
export const canActivateRoute = /* @__PURE__ */ owned(standalone.canActivateRoute);

/** Legacy runtime facade; state getters also opt into the default-App owner. */
export const auth: typeof standalone.auth = {
  get user() { ensureOwner(); return standalone.auth.user; },
  get tokens() { ensureOwner(); return standalone.auth.tokens; },
  get isLoading() { ensureOwner(); return standalone.auth.isLoading; },
  get error() { ensureOwner(); return standalone.auth.error; },
  get isAuthenticated() { ensureOwner(); return standalone.auth.isAuthenticated; },
  get roles() { ensureOwner(); return standalone.auth.roles; },
  get permissions() { ensureOwner(); return standalone.auth.permissions; },
  login, logout, register, refreshToken, fetchUser: fetchCurrentUser,
  hasRole, hasAnyRole, hasAllRoles, hasPermission, hasAnyPermission, canActivateRoute,
  configure: configureAuth, init: initAuth,
};

export type {
  User, AuthTokens, FunctionalAuthState, LoginCredentials, RegisterData, FunctionalAuthConfig, RouteGuard,
} from '@zenith/auth';
