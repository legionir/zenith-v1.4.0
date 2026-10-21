import type { AuthConfig, FunctionalAuthConfig } from './types';
export function toCanonical(config: Required<FunctionalAuthConfig>): AuthConfig {
  return { loginUrl: config.endpoints.login || '/api/auth/login',
    logoutUrl: config.endpoints.logout, registerUrl: config.endpoints.register,
    refreshUrl: config.endpoints.refresh, meUrl: config.endpoints.me,
    storageKey: config.storageKey, autoRefresh: config.autoRefresh,
    loginRedirect: config.loginRedirect, logoutRedirect: config.logoutRedirect, loginPath: config.loginPath };
}

