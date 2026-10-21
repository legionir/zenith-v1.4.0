import { s, defineOptions } from '@zenith/schema';
import type { AuthConfig, FunctionalAuthConfig } from './types';

export const authConfigOptions = defineOptions<Required<AuthConfig>>(
  'AuthConfig',
  s.object({
    loginUrl: s.string({ min: 1 }),
    logoutUrl: s.default(s.string(), ''),
    refreshUrl: s.default(s.string(), ''),
    meUrl: s.default(s.string(), ''),
    tokenStorage: s.default(
      s.enum(['localStorage', 'sessionStorage', 'cookie', 'memory'] as const),
      'memory',
    ),
    refreshMode: s.default(s.enum(['token', 'cookie'] as const), 'token'),
    tokenKey: s.default(s.string({ min: 1 }), 'zenith_token'),
    refreshTokenKey: s.default(s.string({ min: 1 }), 'zenith_refresh_token'),
    autoRefresh: s.default(s.boolean(), true),
    refreshThreshold: s.default(s.number({ min: 0 }), 300),
    tokenField: s.default(s.string({ min: 1 }), 'token'),
    refreshTokenField: s.default(s.string({ min: 1 }), 'refreshToken'),
    userField: s.default(s.string({ min: 1 }), 'user'),
    expiresInField: s.default(s.string({ min: 1 }), 'expiresIn'),
    headers: s.default(s.record(s.string()), {}),
    registerUrl: s.default(s.string(), ''),
    storageKey: s.default(s.string(), ''),
    loginRedirect: s.default(s.string({ min: 1 }), '/dashboard'),
    logoutRedirect: s.default(s.string({ min: 1 }), '/'),
    loginPath: s.default(s.string({ min: 1 }), '/login'),
  }),
);

export const AUTH_CONFIG_DEFAULTS = authConfigOptions.DEFAULTS;
export const authConfigSchema = authConfigOptions.schema;
export const resolveAuthConfig = (config: unknown): Required<AuthConfig> => {
  const resolved = authConfigOptions.resolve(config);
  return { ...resolved, headers: { ...resolved.headers } };
};

export const FUNCTIONAL_STORAGE_KEY = 'zenith_auth_tokens';

/**
 * #52 — Schema و پیش‌فرض‌های فریزشده برای `FunctionalAuthConfig` در مرز ورودی.
 */
export const functionalAuthConfigOptions = defineOptions<Required<FunctionalAuthConfig>>(
  'FunctionalAuthConfig',
  s.object({
    endpoints: s.default(
      s.object({
        login: s.default(s.string({ min: 1 }), '/api/auth/login'),
        logout: s.default(s.string({ min: 1 }), '/api/auth/logout'),
        register: s.default(s.string({ min: 1 }), '/api/auth/register'),
        refresh: s.default(s.string({ min: 1 }), '/api/auth/refresh'),
        me: s.default(s.string({ min: 1 }), '/api/auth/me'),
      }),
      {
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        register: '/api/auth/register',
        refresh: '/api/auth/refresh',
        me: '/api/auth/me',
      },
    ),
    storageKey: s.default(s.string({ min: 1 }), FUNCTIONAL_STORAGE_KEY),
    autoRefresh: s.default(s.boolean(), true),
    loginRedirect: s.default(s.string({ min: 1 }), '/dashboard'),
    logoutRedirect: s.default(s.string({ min: 1 }), '/'),
    loginPath: s.default(s.string({ min: 1 }), '/login'),
  }),
);

export const FUNCTIONAL_AUTH_CONFIG_DEFAULTS = functionalAuthConfigOptions.DEFAULTS;
export const functionalAuthConfigSchema = functionalAuthConfigOptions.schema;
export const resolveFunctionalAuthConfig = (cfg?: unknown): Required<FunctionalAuthConfig> =>
  functionalAuthConfigOptions.resolve(cfg);

