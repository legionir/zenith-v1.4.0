# Strict Content Security Policy (CSP) & Trusted Types Guide (#63)

Zenith is designed from the ground up to operate under a **strict Content Security Policy** without `'unsafe-eval'` or `'unsafe-inline'`:
- `@zenith/expressions` uses an AST parser and interpreter — **never** `eval()` or `new Function()`.
- `@zenith/security` provides `generateCSP()`, `createTrustedTypesPolicy()`, and `setSafeInnerHTML()` for `require-trusted-types-for 'script'`.

---

## 1. Recommended Strict CSP Header

Use `generateCSP` from `@zenith/security` on your server or edge middleware with a per-request cryptographic nonce (`secureId(16)`):

```ts
import { generateCSP, secureId } from '@zenith/security';

const nonce = secureId(16);
const cspHeader = generateCSP({
  nonce,
  strictDynamic: true,
  requireTrustedTypes: true,
});
// default-src 'self';
// script-src 'self' 'nonce-<random>' 'strict-dynamic';
// style-src 'self' 'nonce-<random>';
// img-src 'self' data: https:;
// connect-src 'self';
// object-src 'none';
// base-uri 'self';
// require-trusted-types-for 'script';
// trusted-types zenith
```

---

## 2. Enforcing Trusted Types in the Browser

Initialize the `'zenith'` Trusted Types policy before mounting your application:

```ts
import { createTrustedTypesPolicy } from '@zenith/security';
import { createZenith } from 'zenith';

createTrustedTypesPolicy();

const app = createZenith({
  state: { title: 'Strict CSP Ready' },
});
app.mount('#app');
```

All HTML sinks (`zen-html`, `setSafeInnerHTML`) sanitize input via `sanitizeHTML` and wrap the result in a `TrustedHTML` instance produced by the `'zenith'` policy.
