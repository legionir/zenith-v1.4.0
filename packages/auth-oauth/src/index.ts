// packages/auth-oauth/src/index.ts — @zenith/auth-oauth (#162) L2 barrel.
/** @public */
export {
  createOAuthClient,
  oauthAuthAdapter,
  discover,
} from './client';

/** @public */
export {
  DEFAULTS,
  type OAuthClient,
  type OAuthClientOptions,
  type OAuthTokens,
  type OAuthUser,
  type OAuthStatus,
  type DiscoveryDoc,
} from './types';

/** @public */
export { randomToken, pkceChallenge, base64url } from './pkce';

/** @public */
export {
  parseJwt,
  validateClaims,
  verifyIdToken,
  type JwtClaims,
  type JwtVerifyOptions,
} from './jwt';

/** @public */
export {
  processOAuthLogin,
  processOAuthLogout,
  processOAuthCallback,
  setActiveOAuthClient,
  getActiveOAuthClient,
} from './directives';
