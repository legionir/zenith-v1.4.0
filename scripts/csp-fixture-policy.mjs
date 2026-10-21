// scripts/csp-fixture-policy.mjs
// #63 — strict-CSP e2e fixture helpers (shared by scripts/e2e-server.mjs and
// scripts/test/csp-fixture-policy.test.mjs).
//
// The fixture page (e2e/csp-fixture.html) is served with an ENFORCED
// Content-Security-Policy response header — never report-only, never a
// <meta> tag — with a per-response cryptographic nonce, no 'unsafe-eval' /
// 'unsafe-inline' anywhere, and require-trusted-types-for 'script' so the
// real browser (Chromium) enforces Trusted Types on every script sink.

/** Trusted Types policy name allowlisted by the fixture policy. */
export const CSP_POLICY_NAME = 'zenith';

/** Placeholder in e2e/csp-fixture.html replaced with the per-response nonce. */
export const CSP_NONCE_PLACEHOLDER = '{{NONCE}}';

/** Violation report collector endpoint served by scripts/e2e-server.mjs. */
export const CSP_REPORT_PATH = '/e2e/csp-report';

/** Report listing endpoint (GET) / clearing endpoint (DELETE). */
export const CSP_REPORTS_PATH = '/e2e/csp-reports';

/** Fixture page route. `?violate=1` appends a nonce-less script (negative control). */
export const CSP_FIXTURE_PATH = '/e2e/csp-fixture.html';

/**
 * Build the enforced strict-CSP header value for one response.
 * `nonce` must be a fresh per-response CSPRNG string (the server uses
 * `randomBytes(16).toString('base64')`); this function only formats it.
 */
export function buildStrictCspHeader(nonce) {
  return [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'nonce-${nonce}'`,
    `img-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'none'`,
    `require-trusted-types-for 'script'`,
    `trusted-types ${CSP_POLICY_NAME}`,
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to csp`,
  ].join('; ');
}

/**
 * Substitute every {{NONCE}} placeholder in the fixture HTML with `nonce`.
 * The placeholder only ever appears inside nonce="…" attributes of the
 * fixture's own scripts, so a plain split/join keeps everything else byte-identical.
 */
export function injectFixtureNonce(html, nonce) {
  return html.split(CSP_NONCE_PLACEHOLDER).join(nonce);
}

/** Value for the Reporting-Endpoints response header (Reporting API). */
export function buildReportingEndpointsHeader() {
  return `csp="${CSP_REPORT_PATH}"`;
}
