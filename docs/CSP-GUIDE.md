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

Use `setSafeInnerHTML(element, { html })` for the canonical package sink. It
sanitizes by default and passes native policy output to the DOM setter when a
Trusted Types policy is available. The positional form is a deprecated bridge
(`ZEN-DEPR-092`). Policy outputs are opaque `unknown` values, not promised strings.

`trusted: true` / `sanitizeHTMLTrusted` are explicit escape hatches, not input
validation. Without a policy they may render unsanitized content; an installed
Zenith policy still sanitizes its input. Do not use them with user-supplied HTML.
The non-DOM regex fallback is not equivalent to DOM sanitization. Unit fixtures
and this setup guide do not by themselves establish real-browser CSP/Trusted
Types enforcement for every runtime/compiler sink.

---

## 8. Executed policy: browser fixture (#63)

The policy below is not a recommendation — it is the exact header the
Playwright gate (`e2e/csp-strict.spec.ts`) asserts against the live fixture
page (`e2e/csp-fixture.html`, served by `scripts/e2e-server.mjs` with a fresh
per-response nonce). If you change `buildStrictCspHeader`, update this section
and the gate together.

```http
Content-Security-Policy: default-src 'self'; script-src 'nonce-<per-response>' 'strict-dynamic'; style-src 'nonce-<per-response>'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types zenith; report-uri /e2e/csp-report; report-to csp
Reporting-Endpoints: csp="/e2e/csp-report"
```

Run the fixture locally (from the repository root):

    node scripts/e2e-server.mjs
    npx playwright test e2e/csp-strict.spec.ts --project=chromium

The spec asserts zero `securitypolicyviolation` events AND zero server-side
reports, a header↔HTML nonce match, a working policy-backed sanitized render,
and a blocked XSS payload. `?violate=1` serves the same page with an extra
nonce-less script: the spec requires that script to be blocked and the
violation to reach both the in-page listener and the server endpoint — the
negative control proving the gate trips instead of passing vacuously.
Firefox/WebKit ignore the Trusted Types directives and report `ttSupported:
false`; only Chromium asserts raw-sink enforcement.

---

## 9. Extension pages and VS Code webview policies (#67)

The fixture policy above covers web pages. The two shipped tools carry
their own stricter policies (no `unsafe-inline` anywhere — not even for
styles). Both are pinned by `scripts/test/extension-csp.test.mjs` and the
webview suite (`tools/vscode-extension/test/webview.test.ts`); the real
packed-extension / Extension-Host runs with violation capture are the #67
validation remainder, not a substitute for these gates.

Browser extension (`tools/devtools-extension/manifest.json`,
`content_security_policy.extension_pages`, mirrored in each page's
`<meta>`):

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Styles arrive only as same-package stylesheets (`popup.css`,
`graph-viewer.css`); dynamic show/hide uses `el.style.*` DOM properties
(outside CSP). No `<style>`, no `style=""`, no inline handlers, no
`innerHTML`/`eval` in extension scripts.

VS Code webview (`tools/vscode-extension/src/webview.ts`,
`buildWebviewCsp`, fresh CSPRNG nonce per panel):

```http
Content-Security-Policy: default-src 'none'; style-src 'nonce-<per-panel>'; img-src <cspSource> data:; font-src <cspSource>; script-src 'nonce-<per-panel>'; connect-src 'none'; base-uri 'none'; form-action 'none'
```

Trusted Types are a browser-page mechanism: they apply to the #63
fixture and web pages, not to MV3 extension pages (which ban inline
scripts outright) or the VS Code webview (nonce-only scripts, DOM-API
rendering).
