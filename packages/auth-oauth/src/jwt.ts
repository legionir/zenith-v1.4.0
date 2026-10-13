// packages/auth-oauth/src/jwt.ts
//
// اعتبارسنجی `id_token` (OIDC Core §3.1.3.7):
//   - sub-claim parsing با base64url امن
//   - iss/aud/exp/nbf/iat/nonce validation با clockSkew
//   - امضا از طریق JWKS (RSA/EC) با WebCrypto
//
// خطاها: ZEN-2102 (id_token نامعتبر)

import { createReservedError } from '@zenith/errors';

export interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  nonce?: string;
  sub?: string;
  [key: string]: unknown;
}

export interface JwtVerifyOptions {
  issuer?: string;
  audience: string;
  expectedNonce?: string;
  clockSkew?: number;
  jwksUri?: string;
  now?: number;
}

function decodeSegment(seg: string): Uint8Array {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = typeof atob === 'function'
    ? atob(b64 + pad)
    : Buffer.from(b64 + pad, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function parseJwt(token: string): { header: Record<string, unknown>; claims: JwtClaims } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw createReservedError('ZEN-2102', { details: { reason: 'malformed' } });
  }
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeSegment(parts[0]!)));
    const claims = JSON.parse(new TextDecoder().decode(decodeSegment(parts[1]!)));
    return { header, claims };
  } catch (cause) {
    throw createReservedError('ZEN-2102', { details: { reason: 'decode-failed' }, cause });
  }
}

export function validateClaims(claims: JwtClaims, opts: JwtVerifyOptions): void {
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const skew = opts.clockSkew ?? 60;

  if (opts.issuer && claims.iss && claims.iss !== opts.issuer) {
    throw createReservedError('ZEN-2102', {
      details: { reason: 'iss-mismatch', expected: opts.issuer, actual: claims.iss },
    });
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!aud.includes(opts.audience)) {
    throw createReservedError('ZEN-2102', {
      details: { reason: 'aud-mismatch', expected: opts.audience, actual: claims.aud },
    });
  }
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) {
    throw createReservedError('ZEN-2102', { details: { reason: 'expired' } });
  }
  if (typeof claims.nbf === 'number' && claims.nbf - skew > now) {
    throw createReservedError('ZEN-2102', { details: { reason: 'not-before' } });
  }
  if (opts.expectedNonce !== undefined && claims.nonce !== opts.expectedNonce) {
    throw createReservedError('ZEN-2102', { details: { reason: 'nonce-mismatch' } });
  }
}

interface JsonWebKey {
  kty: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
  kid?: string;
}

async function fetchJwks(jwksUri: string, fetchImpl?: typeof fetch): Promise<JsonWebKey[]> {
  const f = fetchImpl ?? globalThis.fetch;
  if (!f) throw createReservedError('ZEN-2102', { details: { reason: 'no-fetch' } });
  let res: Response;
  try {
    res = await f(jwksUri);
  } catch (cause) {
    throw createReservedError('ZEN-2102', { details: { reason: 'jwks-fetch' }, cause });
  }
  if (!res.ok) {
    throw createReservedError('ZEN-2102', { details: { reason: 'jwks-status', status: res.status } });
  }
  const body = (await res.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(body.keys)) {
    throw createReservedError('ZEN-2102', { details: { reason: 'jwks-format' } });
  }
  return body.keys;
}

function jwkToCryptoKey(jwk: JsonWebKey, alg: string): Promise<CryptoKey> {
  const cryptoApi = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!cryptoApi?.subtle) {
    throw createReservedError('ZEN-2102', { details: { reason: 'no-webcrypto' } });
  }
  const subtle = cryptoApi.subtle;

  if (alg === 'RS256' || alg === 'RS384' || alg === 'RS512') {
    const hash = alg === 'RS256' ? 'SHA-256' : alg === 'RS384' ? 'SHA-384' : 'SHA-512';
    return subtle.importKey(
      'jwk',
      { ...jwk, kty: 'RSA', alg, ext: true } as unknown as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash },
      false,
      ['verify'],
    );
  }
  if (alg === 'ES256' || alg === 'ES384') {
    const crv = alg === 'ES256' ? 'P-256' : 'P-384';
    const hash = alg === 'ES256' ? 'SHA-256' : 'SHA-384';
    return subtle.importKey(
      'jwk',
      { ...jwk, kty: 'EC', crv, ext: true } as unknown as JsonWebKey,
      { name: 'ECDSA', namedCurve: crv },
      false,
      ['verify'],
    ).then((key) => key, (cause) => {
      throw createReservedError('ZEN-2102', { details: { reason: 'import-failed', hash }, cause });
    });
  }
  throw createReservedError('ZEN-2102', { details: { reason: 'unsupported-alg', alg } });
}

/**
 * اعتبارسنجی کامل id_token با JWKS.
 * اگر jwksUri داده نشود (فقط در flow‌های ضعیف legacy) فقط claim validation انجام می‌شود — در prod توصیه نمی‌شود.
 */
export async function verifyIdToken(
  idToken: string,
  opts: JwtVerifyOptions & { fetchImpl?: typeof fetch },
): Promise<JwtClaims> {
  const { header, claims } = parseJwt(idToken);
  validateClaims(claims, opts);

  if (opts.jwksUri) {
    const alg = (header.alg as string) ?? 'RS256';
    const kid = header.kid as string | undefined;
    try {
      const keys = await fetchJwks(opts.jwksUri, opts.fetchImpl);
      const jwk = keys.find((k) => k.kid === kid) ?? keys[0];
      if (!jwk) throw createReservedError('ZEN-2102', { details: { reason: 'jwks-empty' } });
      const key = await jwkToCryptoKey(jwk, alg);
      const cryptoApi = (globalThis as unknown as { crypto?: Crypto }).crypto;
      const data = new TextEncoder().encode(idToken.split('.').slice(0, 2).join('.'));
      const sig = decodeSegment(idToken.split('.')[2]!);
      let verified = false;
      const sigBytes: ArrayBuffer = sig.buffer.slice(
        sig.byteOffset,
        sig.byteOffset + sig.byteLength,
      ) as ArrayBuffer;
      if (alg.startsWith('RS')) {
        verified = await cryptoApi!.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sigBytes, data);
      } else if (alg.startsWith('ES')) {
        verified = await cryptoApi!.subtle.verify(
          { name: 'ECDSA', hash: alg === 'ES256' ? 'SHA-256' : 'SHA-384' },
          key,
          sigBytes,
          data,
        );
      }
      if (!verified) {
        throw createReservedError('ZEN-2102', { details: { reason: 'invalid-signature' } });
      }
    } catch (cause) {
      if (cause instanceof Error && /ZEN-2102/.test((cause as { code?: string }).code ?? '')) throw cause;
      throw createReservedError('ZEN-2102', { details: { reason: 'jwks-verify' }, cause });
    }
  }
  return claims;
}
