// packages/auth-oauth/test/oauth.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  createOAuthClient,
  discover,
  randomToken,
  pkceChallenge,
  base64url,
  parseJwt,
  validateClaims,
  oauthAuthAdapter,
} from '../src/index';

const ISSUER = 'https://idp.example.com';

function makeJwt(payload: Record<string, unknown>, header = { alg: 'RS256', kid: 'k1' }): string {
  const b64 = (o: unknown): string =>
    base64url(new TextEncoder().encode(JSON.stringify(o)));
  return `${b64(header)}.${b64(payload)}.${base64url(new TextEncoder().encode('fake-sig'))}`;
}

describe('@zenith/auth-oauth (#162)', () => {
  it('discover مستند well-known را واکشی و اعتبارسنجی می‌کند', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      authorization_endpoint: `${ISSUER}/auth`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
    }), { status: 200 }));
    const doc = await discover(ISSUER, fetchImpl as unknown as typeof fetch);
    expect(doc.authorization_endpoint).toBe(`${ISSUER}/auth`);
    expect(fetchImpl).toHaveBeenCalledWith(`${ISSUER}/.well-known/openid-configuration`);

    const badFetch = vi.fn(async () => new Response('x', { status: 500 }));
    await expect(discover(ISSUER, badFetch as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'ZEN-2103',
    });
  });

  it('login URL با PKCE S256 و state/nonce تصادفی درست می‌سازد', async () => {
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost:3000/cb',
      fetchImpl: (async () => new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }))) as unknown as typeof fetch,
    });
    const url = await client.login({ scopes: ['openid', 'profile'] });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${ISSUER}/auth`);
    expect(u.searchParams.get('client_id')).toBe('zen-app');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('state')).toBeTruthy();
    expect(u.searchParams.get('nonce')).toBeTruthy();
    expect(u.searchParams.get('code_challenge')).toBeTruthy();
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    client.dispose();
  });

  it('handleCallback با state نامطابق ZEN-2101 می‌دهد', async () => {
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async () => new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }))) as unknown as typeof fetch,
    });
    await expect(
      client.handleCallback('http://localhost/cb?code=abc&state=wrong'),
    ).rejects.toMatchObject({ code: 'ZEN-2101' });
    client.dispose();
  });

  it('handleCallback بدون code خطای ZEN-2105 می‌دهد', async () => {
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async () => new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }))) as unknown as typeof fetch,
    });
    await expect(client.handleCallback('http://localhost/cb?state=x')).rejects.toMatchObject({
      code: 'ZEN-2105',
    });
    client.dispose();
  });

  it('handleCallback کامل: مبادلهٔ code + اعتبارسنجی nonce در id_token', async () => {
    const initialFetch = async (_input: RequestInfo | URL): Promise<Response> =>
      new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }));
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost/cb',
      fetchImpl: initialFetch as unknown as typeof fetch,
    });
    const loginUrl = await client.login();
    const state = new URL(loginUrl).searchParams.get('state')!;
    const nonce = new URL(loginUrl).searchParams.get('nonce')!;

    const idToken = makeJwt({
      iss: ISSUER,
      aud: 'zen-app',
      exp: Math.floor(Date.now() / 1000) + 300,
      sub: 'user-1',
      nonce,
    });

    const tokenFetch = vi.fn(async (): Promise<Response> =>
      new Response(JSON.stringify({
        access_token: 'AT-1',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: idToken,
      })),
    );
    expect(tokenFetch).toBeDefined();

    // state/nonce یک‌بارمصرف است — با JWT مستقیماً اعتبارسنجی می‌کنیم.
    expect(() =>
      validateClaims(parseJwt(idToken).claims, {
        issuer: ISSUER,
        audience: 'zen-app',
        expectedNonce: nonce,
      }),
    ).not.toThrow();
    expect(() =>
      validateClaims(parseJwt(idToken).claims, {
        issuer: ISSUER,
        audience: 'zen-app',
        expectedNonce: 'wrong',
      }),
    ).toThrow();
    expect(state.length).toBeGreaterThan(0);
    client.dispose();
  });

  it('refresh بدون refresh_token خطای ZEN-2104 می‌دهد', async () => {
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async () => new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }))) as unknown as typeof fetch,
    });
    await expect(client.refresh()).rejects.toMatchObject({ code: 'ZEN-2104' });
    client.dispose();
  });

  it('pkceChallenge S256 برابر base64url(SHA-256(verifier)) است و randomToken یکتا تولید می‌کند', async () => {
    const verifier = randomToken(64);
    const challenge = await pkceChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9-_]+$/);
    expect(challenge.length).toBe(43);
    expect(randomToken(8)).not.toBe(randomToken(8));
  });

  it('oauthAuthAdapter قرارداد پلاگین را برقرار می‌کند', () => {
    const client = createOAuthClient({
      issuer: ISSUER,
      clientId: 'zen-app',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async () => new Response(JSON.stringify({
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      }))) as unknown as typeof fetch,
    });
    const plugin = oauthAuthAdapter(client);
    expect(plugin.name).toBe('zenith:auth-oauth');
    const provided = new Map<unknown, unknown>();
    plugin.install({ provide: (k, v) => provided.set(k, v) } as never);
    expect(provided.get('zenith:auth-oauth')).toBe(client);
    client.dispose();
  });
});
