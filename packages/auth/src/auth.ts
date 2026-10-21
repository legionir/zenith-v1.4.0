// packages/auth/src/auth.ts
//
// @zenith/auth — Authentication Runtime (Phase 4).
//
// این پکیج مدیریت کامل authentication را فراهم می‌کند:
//   - login / logout / register
//   - token management (access + refresh)
//   - session persistence (localStorage / cookie)
//   - auto-refresh قبل از expiry
//   - route guards (redirect به login اگر unauthorized)
//   - user state reactive (Signal)
//
// ── سینتکس ─ـ
//
//   // main.ts
//   import { createAuth } from '@zenith/auth';
//
//   const auth = createAuth({
//     loginUrl: '/api/auth/login',
//     logoutUrl: '/api/auth/logout',
//     refreshUrl: '/api/auth/refresh',
//     meUrl: '/api/auth/me',
//     tokenStorage: 'memory',           // persistence is an explicit, XSS-sensitive choice
//     tokenKey: 'zenith_token',
//     refreshTokenKey: 'zenith_refresh_token',
//     autoRefresh: true,
//     refreshThreshold: 300,             // 5 دقیقه قبل از expiry
//   });
//
//   // در State:
//   const state = { auth: auth.signal, ... };
//
//   // در HTML:
//   <div zen-if="$auth.user">
//     خوش آمدید <span zen-text="$auth.user.name"></span>
//     <button zen-action="authLogout">خروج</button>
//   </div>
//   <div zen-if="!$auth.user">
//     <form zen-action:submit.prevent="authLogin">
//       <input name="email" placeholder="Email">
//       <input name="password" type="password" placeholder="Password">
//       <button type="submit">ورود</button>
//     </form>
//   </div>

// Compatibility facade. Modules below have no runtime back-edge to this barrel.
export { Auth } from './engine';
export { createAuth, registerAuth, getAuth, hasAuth, listAuths, unregisterAuth, clearAuth,
  clearAuthInternal, getDefaultAuth, setAuthRegistryOwner, type AuthRegistryOwner } from './registry';
export * from './functional';
export { authConfigOptions, AUTH_CONFIG_DEFAULTS, authConfigSchema, resolveAuthConfig,
  functionalAuthConfigOptions, FUNCTIONAL_AUTH_CONFIG_DEFAULTS, functionalAuthConfigSchema,
  resolveFunctionalAuthConfig } from './options';
export type { AuthUser, AuthState, AuthConfig, User, AuthTokens, FunctionalAuthState,
  LoginCredentials, RegisterData, FunctionalAuthConfig, RouteGuard, AuthEvent, AuthEventListener } from './types';
