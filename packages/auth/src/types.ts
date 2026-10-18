import type { Signal, ReadonlySignal } from '@zenith/state';

/** Canonical session/configuration and legacy compatibility contracts; no engine imports. */
export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
}

export interface AuthState {
  /** کاربر فعلی (null اگر لاگین نکرده). */
  user: AuthUser | null;
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** آیا لاگین کرده؟ */
  isAuthenticated: boolean;
  /** Access token. */
  token: string | null;
  /** Refresh token. */
  refreshToken: string | null;
  /** زمان انقضای token (timestamp). */
  tokenExpiry: number | null;
  /** پیام خطا. */
  error: string | null;
}

export interface AuthConfig {
  /** URL لاگین. */
  loginUrl: string;
  /** URL خروج. */
  logoutUrl?: string;
  /** URL refresh token. */
  refreshUrl?: string;
  /** URL دریافت کاربر فعلی. */
  meUrl?: string;
  /**
   * روش ذخیره token: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'.
   *
   * SEC FIX (v1.2.6): SEC-A8 — the default is now `'memory'` (was
   * `'localStorage'` before v1.0.1). Storing tokens in `localStorage` makes
   * them readable by any JavaScript running on the page, so a single XSS
   * vulnerability anywhere in your dependency tree is enough to leak the
   * user's full session. `'memory'` limits the blast radius to the current
   * tab and survives only as long as the page is open, which is the safest
   * default. If you need cross-tab persistence, prefer server-side
   * `Set-Cookie` with `HttpOnly; Secure; SameSite=Strict` and use
   * `tokenStorage: 'cookie'` here only for non-sensitive metadata.
   */
  tokenStorage?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';
  /** Refresh using an explicit JSON token (legacy default) or a server-set HttpOnly cookie. */
  refreshMode?: 'token' | 'cookie';
  /** کلید ذخیره access token. */
  tokenKey?: string;
  /** کلید ذخیره refresh token. */
  refreshTokenKey?: string;
  /** آیا auto-refresh فعال باشد؟ */
  autoRefresh?: boolean;
  /** چند ثانیه قبل از expiry، refresh انجام شود. */
  refreshThreshold?: number;
  /** نام field در response که token در آن است. */
  tokenField?: string;
  /** نام field در response که refresh token در آن است. */
  refreshTokenField?: string;
  /** نام field در response که user در آن است. */
  userField?: string;
  /** نام field در response که expiry در آن است (ثانیه). */
  expiresInField?: string;
  /** Optional registration endpoint; empty disables registration. */
  registerUrl?: string;
  /** Versioned session-record key; persistence still requires an explicit storage choice/remember. */
  storageKey?: string;
  loginRedirect?: string;
  logoutRedirect?: string;
  loginPath?: string;
  /** هدرهای اضافی. */
  headers?: Record<string, string>;
}

export interface User {
  id: string | number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface FunctionalAuthState {
  user: Signal<User | null>;
  tokens: Signal<AuthTokens | null>;
  isAuthenticated: ReadonlySignal<boolean>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;
  roles: ReadonlySignal<string[]>;
  permissions: ReadonlySignal<string[]>;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  [key: string]: unknown;
}

export interface FunctionalAuthConfig {
  endpoints?: {
    login?: string;
    logout?: string;
    register?: string;
    refresh?: string;
    me?: string;
  };
  storageKey?: string;
  autoRefresh?: boolean;
  loginRedirect?: string;
  logoutRedirect?: string;
  loginPath?: string;
}

export interface RouteGuard {
  requiresAuth?: boolean;
  roles?: string[];
  permissions?: string[];
  canActivate?: () => boolean | Promise<boolean>;
  redirectTo?: string;
}

export type AuthEvent = 'login' | 'logout' | 'token-refresh' | 'token-expired' | 'error';

export type AuthEventListener = (event: AuthEvent, data?: unknown) => void;
