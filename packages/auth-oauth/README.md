# @zenith/auth-oauth

کلاینت OAuth2/OIDC با PKCE (ایشوی `#162` — لایهٔ L2).

## API

| نماد | توضیح |
|---|---|
| `createOAuthClient(options)` | ساخت کلاینت با `login/handleCallback/logout/refresh/getAccessToken` + سیگنال‌های `user`/`status`/`idTokenClaims` |
| `discover(issuer)` | واکشی `/.well-known/openid-configuration` |
| `oauthAuthAdapter(client)` | پلاگین تزریق کلاینت به app (`zenith:auth-oauth`) |
| `parseJwt / validateClaims / verifyIdToken` | ابزار JWT با خطای `ZEN-2102` |

## دایرکتیوها

| attribute | رفتار |
|---|---|
| `zen-oauth-login` | کلیک ⇒ client.login() و redirect؛ `zen-oauth-scope`/`zen-oauth-prompt` اختیاری |
| `zen-oauth-logout` | کلیک ⇒ client.logout()؛ `zen-oauth-federated="true"` پایان فدرال |
| `zen-oauth-callback` | auto handleCallback(url فعلی) هنگام mount |

## امنیت

- `state`/`nonce` با crypto.getRandomValues؛ `code_verifier` با S256.
- اعتبارسنجی `id_token` با JWKS (`iss`, `aud`, `exp`, `nbf`, `nonce`).
- توکن‌ها هرگز در localStorage ذخیره نمی‌شوند (فقط حافظهٔ کلاینت).

## خطاها

- `ZEN-2101` state نامطابق (احتمال CSRF)  
- `ZEN-2102` id_token نامعتبر  
- `ZEN-2103` discovery شکست  
- `ZEN-2104` refresh منقضی  
- `ZEN-2105` callback بدون code
