// packages/auth-oauth/src/directives.ts
//
// دایرکتیوهای `zen-oauth*` (#162):
//   zen-oauth-login      — کلیک ⇒ client.login() و redirect به authorization URL
//   zen-oauth-scope      — scope اضافی (فضای‌جداشده)
//   zen-oauth-prompt     — prompt OIDC
//   zen-oauth-logout     — کلیک ⇒ client.logout()
//   zen-oauth-callback   — auto handleCallback(url) هنگام mount
//   zen-oauth-state      — نام state property در auth (پیش‌فرض 'auth')

import type { OAuthClient } from './client';

let activeClient: OAuthClient | null = null;

export function setActiveOAuthClient(client: OAuthClient | null): void {
  activeClient = client;
}

export function getActiveOAuthClient(): OAuthClient | null {
  return activeClient;
}

/**
 * #162: `zen-oauth-login` — ریدایرکت به صفحهٔ ورود IdP (authorization code + PKCE).
 */
export function processOAuthLogin(el: HTMLElement, _provider: string): () => void {
  const client = activeClient;
  if (!client) return () => {};

  const onClick = async (ev: Event): Promise<void> => {
    ev.preventDefault();
    el.setAttribute('aria-busy', 'true');
    try {
      const scopes = el.getAttribute('zen-oauth-scope')?.split(/\s+/).filter(Boolean);
      const prompt = el.getAttribute('zen-oauth-prompt') ?? undefined;
      const url = await client.login({ scopes, prompt });
      if (typeof window !== 'undefined') {
        window.location.assign(url);
      } else {
        el.setAttribute('data-oauth-url', url);
      }
    } catch {
      // خطا توسط createReservedError گزارش شد؛ UI از aria-busy خارج می‌شود.
    } finally {
      el.removeAttribute('aria-busy');
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

/**
 * #162: `zen-oauth-logout` — پایان session محلی (و اختیاری federated).
 */
export function processOAuthLogout(el: HTMLElement, _expr: string): () => void {
  const client = activeClient;
  if (!client) return () => {};
  const onClick = (ev: Event): void => {
    ev.preventDefault();
    const federated = el.getAttribute('zen-oauth-federated') === 'true';
    client.logout({ federated });
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

/**
 * #162: `zen-oauth-callback` — هنگام mount، handleCallback فعلی استفاده می‌شود.
 */
export function processOAuthCallback(_el: HTMLElement, _expr: string): () => void {
  const client = activeClient;
  if (!client) return () => {};
  void client.handleCallback().catch(() => {
    // handleCallback خودش خطای reserved می‌فرستد؛ این‌جا فقط باید render ادامه پیدا کند.
  });
  return () => {};
}
