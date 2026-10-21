---
---

#67: extension strict CSP — zero unsafe-inline (code-first, unrun).

Recon: steps 1–3 (real Chromium extension + VS Code Extension Host runs
with CSP/console/DOM capture) need browser/IDE execution and stay in the
validation phase. The genuine code-first remainder was step 4: every page
shipped `style-src 'unsafe-inline'` (two `<style>` blocks + 11 static
`style=""` attributes in popup.html; webview `<style>` + 4 static
`style=""`), while docs already forbade claiming "no unsafe-inline".

Implemented:

- `tools/devtools-extension/popup.css` + `graph-viewer.css` (new):
  byte-exact extraction of the two `<style>` blocks (uniform 6-space HTML
  indent stripped back to canonical 2-space CSS) + 7 utility classes
  replacing the static `style=""` attributes (`.stat-spaced`,
  `.danger-value`, `.warn-value`, `.cache-row`, `.cache-value`,
  `.cache-flex`, `.cache-size-spaced`); `.cache-bar-fill` gains `width: 0`
  (JS still drives it via `el.style.width`, which needs no CSP keyword).
- `popup.html` / `graph-viewer.html`: `<style>` → `<link rel="stylesheet">`
  (picked up automatically by `build-tools.mjs`, which already allows
  `.css` and validates `<link href>` targets); static `style=""` →
  classes; CSP metas now `style-src 'self'`.
- `manifest.json`: `extension_pages` drops `'unsafe-inline'` (script-src
  was already `'self'`-only); `devtools.html` meta matches.
- `tools/vscode-extension/src/webview.ts`: `style-src 'nonce-…'` (same
  per-panel nonce as scripts), `<style nonce>`, 4 static `style=""` →
  `.subtitle` class / `hidden` attribute (JS `el.style.display` overrides
  it — no CSP keyword needed); header + CSP comments reworded to the
  no-unsafe-inline rule.
- `tools/vscode-extension/test/webview.test.ts`: pins updated (nonce
  style-src, zero `'unsafe-inline'` in the whole policy, `<style nonce>`,
  no `style=` in generated HTML).
- `scripts/test/extension-csp.test.mjs` (new, source-only): manifest/page
  policies contain zero `unsafe-inline` and page metas equal the manifest
  policy minus `frame-ancestors`; no `<style`/`style=`/inline handlers in
  pages; every `<script>` has `src`; every page boots via
  `message-schema.js`; no `innerHTML`/`outerHTML`/`insertAdjacentHTML`/
  `document.write`/`eval(`/`new Function(`/string-`setTimeout` in
  extension scripts; same zero-`unsafe-inline` bar for the webview source.
- `tools/devtools-extension/README.md`: file list + policy paragraph now
  state the verbatim no-unsafe-inline policy and the external-sheet rule.

Deliberate non-goals (validation/owner): real packed-extension run in
Chromium (install, message matrices, CSP-violation/console/DOM capture,
negative controls) + real VS Code Extension Host webview run with fresh
nonce per panel (steps 1–3); run new + existing suites
(`extension-csp`, `webview`, `devtools-message-schema`); `format:check`
over the two new CSS files; store publish stays WAITING-OWNER (#97).
