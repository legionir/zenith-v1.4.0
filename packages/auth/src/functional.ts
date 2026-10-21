import { Signal, type ReadonlySignal } from '@zenith/state';
import { developerError, ErrorCode } from '@zenith/errors';
import { resolveFunctionalAuthConfig, FUNCTIONAL_STORAGE_KEY } from './options';
import { toCanonical } from './configuration-adapter';
import { getDefaultAuth, defaultAuthRef } from './registry';
import type { AuthState, User, AuthTokens, FunctionalAuthState, LoginCredentials, RegisterData, FunctionalAuthConfig, RouteGuard } from './types';
export function configureAuth(cfg: Partial<FunctionalAuthConfig>): void {
  const previous = getAuthConfig();
  const candidate = cfg && typeof cfg === 'object' && !Array.isArray(cfg)
    ? { ...previous, ...cfg, ...(cfg.endpoints && typeof cfg.endpoints === 'object' && !Array.isArray(cfg.endpoints)
      ? { endpoints: { ...previous.endpoints, ...cfg.endpoints } } : {}) } : cfg;
  const resolved = resolveFunctionalAuthConfig(candidate);
  getDefaultAuth().configure(toCanonical(resolved));
}

export function getAuthConfig(): Required<FunctionalAuthConfig> {
  const config = getDefaultAuth().getConfig();
  return { endpoints: { login: config.loginUrl, logout: config.logoutUrl, register: config.registerUrl,
    refresh: config.refreshUrl, me: config.meUrl }, storageKey: config.storageKey || FUNCTIONAL_STORAGE_KEY,
    autoRefresh: config.autoRefresh, loginRedirect: config.loginRedirect,
    logoutRedirect: config.logoutRedirect, loginPath: config.loginPath };
}

function functionalSource(tracked: boolean): Signal<AuthState> {
  if (tracked) defaultAuthRef.get();
  return getDefaultAuth().signal;
}

/** Writable compatibility view, never a second authentication state machine.
 * The inherited placeholder is not used after construction: all reads/writes
 * and effect dependencies resolve to the selected canonical engine.
 */
class AuthSignalView<T> extends Signal<T> {
  constructor(initial: T, private readonly read: (tracked: boolean) => T,
    private readonly write: (value: T) => void) { super(initial); }
  override get(): T { return this.read ? this.read(true) : super.get(); }
  override peek(): T { return this.read ? this.read(false) : super.peek(); }
  override set(value: T): void { this.write(value); }
  override update(update: (value: T) => T): void { this.write(update(this.peek())); }
}

function stateView<T>(initial: T, read: (state: AuthState) => T,
  write: (state: AuthState, value: T) => AuthState): Signal<T> {
  return new AuthSignalView(initial, tracked => {
    const source = functionalSource(tracked);
    return read(tracked ? source.get() : source.peek());
  }, value => functionalSource(false).update(state => write(state, value)));
}

const functionalUser = stateView<User | null>(null, state => state.user ? {
  ...state.user, roles: state.user.roles ?? [], permissions: state.user.permissions ?? [],
} : null, (state, user) => ({ ...state, user, isAuthenticated: !!user && !!state.token }));
const functionalTokens = stateView<AuthTokens | null>(null, state => state.token ? {
  accessToken: state.token, ...(state.refreshToken ? { refreshToken: state.refreshToken } : {}),
  ...(state.tokenExpiry !== null ? { expiresAt: state.tokenExpiry } : {}),
} : null, (state, tokens) => ({ ...state, token: tokens?.accessToken ?? null,
  refreshToken: tokens?.refreshToken ?? null, tokenExpiry: tokens?.expiresAt ?? null,
  isAuthenticated: !!tokens && !!state.user }));
const functionalIsLoading = stateView(false, state => state.loading, (state, loading) => ({ ...state, loading }));
const functionalAuthError = stateView<string | null>(null, state => state.error, (state, error) => ({ ...state, error }));
function readonlyView<T>(initial: T, read: (state: AuthState) => T): ReadonlySignal<T> {
  return stateView(initial, read, () => { throw developerError('Cannot write to a readonly authentication view.', 'ZEN-907'); });
}
const functionalIsAuthenticated = readonlyView(false, state => state.isAuthenticated);
const functionalRoles = readonlyView<string[]>([], state => state.user?.roles ?? []);
const functionalPermissions = readonlyView<string[]>([], state => state.user?.permissions ?? []);

export async function initAuth(): Promise<void> { await getDefaultAuth().init(); }

export async function login(credentials: LoginCredentials): Promise<User | null> {
  const instance = getDefaultAuth();
  if (!await instance.login({ ...credentials }, { remember: credentials.remember ?? false })) return null;
  const user = instance.user;
  return user ? { ...user, roles: user.roles ?? [], permissions: user.permissions ?? [] } : null;
}

export async function register(data: RegisterData): Promise<User | null> {
  const instance = getDefaultAuth();
  // Registration is memory-only by default, like canonical createAuth().
  if (!await instance.register(data)) return null;
  const user = instance.user;
  return user ? { ...user, roles: user.roles ?? [], permissions: user.permissions ?? [] } : null;
}

export async function logout(notifyServer = true): Promise<void> { await getDefaultAuth().logout(notifyServer); }

export async function refreshToken(): Promise<AuthTokens | null> {
  const instance = getDefaultAuth();
  if (!instance.signal.peek().refreshToken && instance.getConfig().refreshMode !== 'cookie') {
    throw developerError('No refresh token available', ErrorCode.RESOURCE_DESTROYED, {
      category: 'Resource', suggestion: 'ابتدا login کنید تا refreshToken دریافت شود.',
    });
  }
  if (!await instance.refresh()) return null;
  const state = instance.signal.peek();
  return state.token ? { accessToken: state.token, ...(state.refreshToken ? { refreshToken: state.refreshToken } : {}),
    ...(state.tokenExpiry !== null ? { expiresAt: state.tokenExpiry } : {}) } : null;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const instance = getDefaultAuth();
  if (!await instance.fetchUser()) return null;
  const user = instance.user;
  return user ? { ...user, roles: user.roles ?? [], permissions: user.permissions ?? [] } : null;
}

export function hasRole(role: string): boolean {
  return functionalRoles.get().includes(role);
}

export function hasAnyRole(roleList: string[]): boolean {
  return roleList.some((r) => functionalRoles.get().includes(r));
}

export function hasAllRoles(roleList: string[]): boolean {
  return roleList.every((r) => functionalRoles.get().includes(r));
}

export function hasPermission(permission: string): boolean {
  return functionalPermissions.get().includes(permission);
}

export function hasAnyPermission(permList: string[]): boolean {
  return permList.some((p) => functionalPermissions.get().includes(p));
}

export async function canActivateRoute(
  guard: RouteGuard,
): Promise<{ allowed: boolean; redirectTo?: string }> {
  if (guard.requiresAuth && !functionalIsAuthenticated.get()) {
    return { allowed: false, redirectTo: guard.redirectTo || getAuthConfig().loginPath };
  }

  if (guard.roles && guard.roles.length > 0) {
    if (!hasAnyRole(guard.roles)) {
      return { allowed: false, redirectTo: guard.redirectTo || '/forbidden' };
    }
  }

  if (guard.permissions && guard.permissions.length > 0) {
    if (!hasAnyPermission(guard.permissions)) {
      return { allowed: false, redirectTo: guard.redirectTo || '/forbidden' };
    }
  }

  if (guard.canActivate) {
    const allowed = await guard.canActivate();
    if (!allowed) {
      return { allowed: false, redirectTo: guard.redirectTo };
    }
  }

  return { allowed: true };
}

export const auth: FunctionalAuthState & {
  login: typeof login;
  logout: typeof logout;
  register: typeof register;
  refreshToken: typeof refreshToken;
  fetchUser: typeof fetchCurrentUser;
  hasRole: typeof hasRole;
  hasAnyRole: typeof hasAnyRole;
  hasAllRoles: typeof hasAllRoles;
  hasPermission: typeof hasPermission;
  hasAnyPermission: typeof hasAnyPermission;
  canActivateRoute: typeof canActivateRoute;
  configure: typeof configureAuth;
  init: typeof initAuth;
} = {
  user: functionalUser,
  tokens: functionalTokens,
  isAuthenticated: functionalIsAuthenticated,
  isLoading: functionalIsLoading,
  error: functionalAuthError,
  roles: functionalRoles,
  permissions: functionalPermissions,
  login,
  logout,
  register,
  refreshToken,
  fetchUser: fetchCurrentUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  canActivateRoute,
  configure: configureAuth,
  init: initAuth,
};
