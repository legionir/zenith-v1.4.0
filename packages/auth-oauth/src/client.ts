// packages/auth-oauth/src/client.ts
//
// جریان Authorization Code + PKCE (#162):
//   login({provider,scopes,prompt,loginHint}) → redirect به IdP
//   handleCallback(url?) → اعتبارسنجی state/nonce + مبادلهٔ code با token
//   refresh() → silent renew قبل از انقضا
//   tokens فقط در memory (نه localStorage).
//
// خطاها: ZEN-2101..2105

import { createReservedError } from '@zenith/errors';
import { signal, type ReadonlySignal, type Signal } from '@zenith/state';
import { randomToken, pkceChallenge } from './pkce';
import { verifyIdToken, type JwtClaims } from './jwt';
import {
  DEFAULTS,
  type DiscoveryDoc,
  type OAuthClient,
  type OAuthClientOptions,
  type OAuthStatus,
  type OAuthTokens,
  type OAuthUser,
  type PendingState,
  type PendingStore,
} from './types';

export async function discover(issuer: string, fetchImpl?: typeof fetch): Promise<DiscoveryDoc> {
  const f = fetchImpl ?? globalThis.fetch;
  if (!f) throw createReservedError('ZEN-2103', { details: { reason: 'no-fetch' } });
  const wellKnown = `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  let res: Response;
  try {
    res = await f(wellKnown);
  } catch (cause) {
    throw createReservedError('ZEN-2103', { cause });
  }
  if (!res.ok) throw createReservedError('ZEN-2103', { details: { status: res.status } });
  try {
    const doc = (await res.json()) as DiscoveryDoc;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
      throw createReservedError('ZEN-2103', { details: { reason: 'incomplete-doc' } });
    }
    return doc;
  } catch (cause) {
    if ((cause as { code?: string }).code === 'ZEN-2103') throw cause;
    throw createReservedError('ZEN-2103', { cause });
  }
}

export function createOAuthClient(options: OAuthClientOptions): OAuthClient {
  const opts = { ...DEFAULTS, ...options };
  const userSig: Signal<OAuthUser | null> = signal(null);
  const claimsSig: Signal<JwtClaims | null> = signal(null);
  const status: Signal<OAuthStatus> = signal('idle');
  const store: PendingStore = { pending: new Map() };
  let tokens: OAuthTokens | null = null;
  let renewTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let discovered: DiscoveryDoc | null = null;

  async function endpoints() {
    if (discovered) return discovered;
    if (!opts.issuer) {
      if (opts.authorizationEndpoint && opts.tokenEndpoint && opts.jwksUri) {
        discovered = {
          authorization_endpoint: opts.authorizationEndpoint,
          token_endpoint: opts.tokenEndpoint,
          jwks_uri: opts.jwksUri,
          end_session_endpoint: opts.endSessionEndpoint,
        };
        return discovered;
      }
      throw createReservedError('ZEN-2103', { details: { reason: 'no-issuer' } });
    }
    discovered = await discover(opts.issuer, opts.fetchImpl);
    return discovered;
  }

  function scheduleRenew(): void {
    if (!opts.silentRenew || !tokens?.expiresAt) return;
    const delay = Math.max(0, tokens.expiresAt - Date.now() - opts.renewBefore);
    renewTimer = setTimeout(() => {
      client.refresh().catch(() => {
        status.set('error');
      });
    }, delay);
    if (typeof renewTimer === 'object' && renewTimer !== null && 'unref' in renewTimer) {
      (renewTimer as unknown as { unref: () => void }).unref();
    }
  }

  async function exchangeCode(code: string, pending: PendingState): Promise<OAuthTokens> {
    const ep = await endpoints();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: opts.redirectUri,
      client_id: opts.clientId,
    });
    if (pending.codeVerifier) body.set('code_verifier', pending.codeVerifier);

    const f = opts.fetchImpl ?? globalThis.fetch;
    if (!f) throw createReservedError('ZEN-2102', { details: { reason: 'no-fetch' } });
    let res: Response;
    try {
      res = await f(ep.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (cause) {
      throw createReservedError('ZEN-2102', { details: { reason: 'exchange-failed' }, cause });
    }
    if (!res.ok)
      throw createReservedError('ZEN-2102', {
        details: { reason: 'token-status', status: res.status },
      });
    const json = (await res.json()) as Record<string, unknown>;
    const accessToken = json.access_token as string | undefined;
    if (!accessToken)
      throw createReservedError('ZEN-2102', { details: { reason: 'no-access-token' } });

    const result: OAuthTokens = {
      accessToken,
      tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
      scope: typeof json.scope === 'string' ? json.scope : undefined,
    };
    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
    if (expiresIn !== undefined) result.expiresAt = Date.now() + expiresIn * 1000;
    if (typeof json.refresh_token === 'string') result.refreshToken = json.refresh_token;
    if (typeof json.id_token === 'string') {
      result.idToken = json.id_token;
      const claims = await verifyIdToken(json.id_token, {
        issuer: opts.issuer ?? discovered?.issuer,
        audience: opts.clientId,
        expectedNonce: pending.nonce,
        clockSkew: opts.clockSkew,
        jwksUri: ep.jwks_uri,
        fetchImpl: opts.fetchImpl,
      });
      claimsSig.set(claims);
      userSig.set({
        sub: String(claims.sub ?? ''),
        ...(claims as Record<string, unknown> as object),
      } as OAuthUser);
    }
    return result;
  }

  const client: OAuthClient = {
    user: userSig as ReadonlySignal<OAuthUser | null>,
    status,
    idTokenClaims: claimsSig as ReadonlySignal<JwtClaims | null>,

    async login(loginOpts = {}): Promise<string> {
      if (disposed) throw createReservedError('ZEN-2102', { details: { reason: 'disposed' } });
      const ep = await endpoints();
      const state = randomToken(16);
      const nonce = randomToken(16);
      const codeVerifier = opts.pkce !== false ? randomToken(64) : undefined;
      store.pending.set(state, {
        state,
        nonce,
        codeVerifier,
        createdAt: Date.now(),
      });

      const params = new URLSearchParams({
        client_id: opts.clientId,
        redirect_uri: opts.redirectUri,
        response_type: opts.responseType,
        scope: (loginOpts.scopes ?? opts.scopes).join(' '),
        state,
        nonce,
      });
      if (loginOpts.prompt) params.set('prompt', loginOpts.prompt);
      if (loginOpts.loginHint) params.set('login_hint', loginOpts.loginHint);
      if (opts.extraParams) {
        for (const [k, v] of Object.entries(opts.extraParams)) params.set(k, v);
      }
      if (codeVerifier) {
        const challenge = await pkceChallenge(codeVerifier);
        params.set('code_challenge', challenge);
        params.set('code_challenge_method', 'S256');
      }
      status.set('awaiting-redirect');
      return `${ep.authorization_endpoint}?${params.toString()}`;
    },

    async handleCallback(url?: string): Promise<OAuthTokens> {
      const href =
        url ??
        (typeof window !== 'undefined' && window.location ? window.location.href : undefined);
      if (!href) throw createReservedError('ZEN-2105', { details: { reason: 'no-url' } });
      const params = new URL(href).searchParams;
      const code = params.get('code');
      const stateParam = params.get('state');
      if (!code) {
        const err = params.get('error');
        throw createReservedError('ZEN-2105', {
          details: err ? { error: err } : { reason: 'no-code' },
        });
      }
      if (!stateParam) throw createReservedError('ZEN-2101', { details: { reason: 'no-state' } });
      const pending = store.pending.get(stateParam);
      if (!pending) throw createReservedError('ZEN-2101', { details: { reason: 'unknown-state' } });
      if (Date.now() - pending.createdAt > opts.stateTtl) {
        store.pending.delete(stateParam);
        throw createReservedError('ZEN-2101', { details: { reason: 'state-expired' } });
      }
      store.pending.delete(stateParam);

      const result = await exchangeCode(code, pending);
      tokens = result;
      status.set('authenticated');
      scheduleRenew();
      return result;
    },

    logout(logoutOpts = {}): void {
      tokens = null;
      userSig.set(null);
      claimsSig.set(null);
      status.set('idle');
      if (renewTimer !== undefined) clearTimeout(renewTimer);
      if (logoutOpts.federated && opts.endSessionEndpoint && typeof window !== 'undefined') {
        const params = new URLSearchParams({ client_id: opts.clientId });
        window.location.assign(`${opts.endSessionEndpoint}?${params.toString()}`);
      }
    },

    async refresh(): Promise<OAuthTokens> {
      const current = tokens;
      if (!current?.refreshToken) {
        throw createReservedError('ZEN-2104', { details: { reason: 'no-refresh-token' } });
      }
      const ep = await endpoints();
      const f = opts.fetchImpl ?? globalThis.fetch;
      if (!f) throw createReservedError('ZEN-2104', { details: { reason: 'no-fetch' } });
      let res: Response;
      try {
        res = await f(ep.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: current.refreshToken,
            client_id: opts.clientId,
          }),
        });
      } catch (cause) {
        throw createReservedError('ZEN-2104', { cause });
      }
      if (!res.ok)
        throw createReservedError('ZEN-2104', {
          details: { status: res.status },
        });
      const json = (await res.json()) as Record<string, unknown>;
      const next: OAuthTokens = {
        accessToken: json.access_token as string,
        tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
        scope: typeof json.scope === 'string' ? json.scope : current.scope,
      };
      const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
      next.expiresAt = expiresIn !== undefined ? Date.now() + expiresIn * 1000 : current.expiresAt;
      next.refreshToken =
        typeof json.refresh_token === 'string' ? json.refresh_token : current.refreshToken;
      if (typeof json.id_token === 'string') {
        next.idToken = json.id_token;
        if (claimsSig.get()) {
          const claims = await verifyIdToken(json.id_token, {
            issuer: opts.issuer ?? discovered?.issuer,
            audience: opts.clientId,
            clockSkew: opts.clockSkew,
            jwksUri: ep.jwks_uri,
            fetchImpl: opts.fetchImpl,
          });
          claimsSig.set(claims);
        }
      }
      tokens = next;
      scheduleRenew();
      return next;
    },

    getAccessToken(): string | null {
      return tokens?.accessToken ?? null;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      tokens = null;
      userSig.set(null);
      claimsSig.set(null);
      status.set('idle');
      store.pending.clear();
      if (renewTimer !== undefined) clearTimeout(renewTimer);
    },
  };

  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    (client as unknown as Record<symbol, () => void>)[Symbol.dispose] = () => client.dispose();
  }
  return client;
}

/**
 * #162: adapter برای تزریق OAuth به @zenith/auth.
 * توکن‌ها در حافظهٔ کلاینت OAuth می‌مانند — فقط user به auth منتقل می‌شود
 * تا permission/route guardها بدون تغییر کار کنند.
 */
export function oauthAuthAdapter(client: OAuthClient) {
  return {
    name: 'zenith:auth-oauth',
    install(app: { provide?: (key: string | symbol, value: unknown) => void }) {
      app?.provide?.('zenith:auth-oauth', client);
      return () => client.dispose();
    },
  };
}
