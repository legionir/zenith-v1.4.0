// packages/auth-oauth/src/types.ts
//
// OAuth client shapes. Pure declarations — no runtime imports, so type-only
// consumers never pull fetch/crypto/DOM-touching code into their graph.
import type { Disposable } from '@zenith/shared';
import type { ReadonlySignal, Signal } from '@zenith/state';
import type { JwtClaims } from './jwt';

export type OAuthStatus = 'idle' | 'awaiting-redirect' | 'authenticated' | 'error';

export interface OAuthUser {
  sub: string;
  name?: string;
  email?: string;
  [claim: string]: unknown;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  tokenType: string;
  scope?: string;
}

export interface OAuthClientOptions {
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  pkce?: boolean;
  responseType?: string;
  /** storage فقط برای state نگهداری می‌شود؛ token هرگز در آن ذخیره نمی‌شود. */
  silentRenew?: boolean;
  renewBefore?: number;
  stateTtl?: number;
  clockSkew?: number;
  extraParams?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface OAuthClient extends Disposable {
  readonly user: ReadonlySignal<OAuthUser | null>;
  readonly status: Signal<OAuthStatus>;
  readonly idTokenClaims: ReadonlySignal<JwtClaims | null>;
  login(opts?: {
    provider?: string;
    scopes?: string[];
    prompt?: string;
    loginHint?: string;
  }): Promise<string>;
  handleCallback(url?: string): Promise<OAuthTokens>;
  logout(opts?: { federated?: boolean }): void;
  refresh(): Promise<OAuthTokens>;
  getAccessToken(): string | null;
  dispose(): void;
}

/**
 * #53 / #162: پیش‌فرض‌های منجمد OAuth client.
 * @default { scopes: ['openid','profile','email'], pkce: true, responseType: 'code', silentRenew: true, renewBefore: 60_000, stateTtl: 600_000, clockSkew: 60 }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  scopes: Object.freeze(['openid', 'profile', 'email']),
  pkce: true,
  responseType: 'code',
  silentRenew: true,
  renewBefore: 60_000,
  stateTtl: 600_000,
  clockSkew: 60,
});

export interface PendingState {
  state: string;
  nonce: string;
  codeVerifier?: string;
  createdAt: number;
}

export interface PendingStore {
  pending: Map<string, PendingState>;
}

export interface DiscoveryDoc {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  issuer?: string;
}
