// packages/auth-oauth/src/pkce.ts
//
// PKCE (RFC 7636) — state/nonce/code_verifier با crypto ایمن.

/** تولید رشتهٔ تصادفی base64url از سیستم crypto (browser/Node 19+). */
export function randomToken(byteLength = 32): string {
  const cryptoApi = (globalThis as unknown as { crypto?: Crypto }).crypto;
  const bytes = new Uint8Array(byteLength);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // Node 18: crypto.randomFillSync از node:crypto (فقط در محیط Node).
    const nodeCrypto = (globalThis as unknown as { process?: { getBuiltinModule?: (m: string) => { randomFillSync: (arr: Uint8Array) => void } } })
      .process?.getBuiltinModule?.('node:crypto');
    if (nodeCrypto) {
      nodeCrypto.randomFillSync(bytes);
    } else {
      throw new Error('[auth-oauth] crypto API در دسترس نیست.');
    }
  }
  return base64url(bytes);
}

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  // btoa در browser و Node ≥16 هر دو وجود دارد.
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 challenge برای code_verifier (S256). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const cryptoApi = (globalThis as unknown as { crypto?: Crypto }).crypto;
  const enc = new TextEncoder();
  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest('SHA-256', enc.encode(verifier));
    return base64url(new Uint8Array(digest));
  }
  // Node fallback
  const nodeCrypto = (globalThis as unknown as { process?: { getBuiltinModule?: (m: string) => { createHash: (a: string) => { update: (d: Uint8Array) => { digest: () => Buffer } } } } })
    .process?.getBuiltinModule?.('node:crypto');
  if (nodeCrypto) {
    const digest = nodeCrypto.createHash('sha256').update(enc.encode(verifier)).digest();
    return base64url(new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength));
  }
  throw new Error('[auth-oauth] crypto.subtle برای PKCE S256 در دسترس نیست.');
}
