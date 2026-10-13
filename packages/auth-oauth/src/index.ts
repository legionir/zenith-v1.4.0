// packages/auth-oauth/src/index.ts — @zenith/auth-oauth (#162) L2 barrel.
export {
  createOAuthClient,
  oauthAuthAdapter,
  discover,
  DEFAULTS,
  type OAuthClient,
  type OAuthClientOptions,
  type OAuthTokens,
  type OAuthUser,
  type OAuthStatus,
  type DiscoveryDoc,
} from './client';

export { randomToken, pkceChallenge, base64url } from './pkce';

export {
  parseJwt,
  validateClaims,
  verifyIdToken,
  type JwtClaims,
  type JwtVerifyOptions,
} from './jwt';

export {
  processOAuthLogin,
  processOAuthLogout,
  processOAuthCallback,
  setActiveOAuthClient,
  getActiveOAuthClient,
} from './directives';
