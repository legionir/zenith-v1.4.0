// scripts/test/csp-fixture-policy.test.mjs
// #63 — unit tests for the strict-CSP fixture header/nonce helpers.
// Browser enforcement itself is covered by e2e/csp-strict.spec.ts; these pin
// the exact enforced policy shape so a future edit cannot silently weaken it
// (e.g. re-introduce unsafe-inline or drop require-trusted-types-for).
import { describe, it, expect } from 'vitest';
import {
  CSP_POLICY_NAME,
  CSP_NONCE_PLACEHOLDER,
  CSP_REPORT_PATH,
  CSP_REPORTS_PATH,
  CSP_FIXTURE_PATH,
  buildStrictCspHeader,
  injectFixtureNonce,
  buildReportingEndpointsHeader,
} from '../csp-fixture-policy.mjs';

describe('#63 — strict-CSP fixture policy helpers', () => {
  it('builds an enforced header with nonce, strict-dynamic, and TT enforcement', () => {
    const nonce = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab==';
    const header = buildStrictCspHeader(nonce);
    expect(header).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic'`);
    expect(header).toContain(`style-src 'nonce-${nonce}'`);
    expect(header).toContain(`default-src 'self'`);
    expect(header).toContain(`object-src 'none'`);
    expect(header).toContain(`base-uri 'none'`);
    expect(header).toContain(`form-action 'none'`);
    expect(header).toContain(`require-trusted-types-for 'script'`);
    expect(header).toContain(`trusted-types ${CSP_POLICY_NAME}`);
    expect(header).toContain(`report-uri ${CSP_REPORT_PATH}`);
    expect(header).toContain(`report-to csp`);
    expect(header).not.toContain('report-only');
    expect(header).not.toContain('unsafe-eval');
    expect(header).not.toContain('unsafe-inline');
  });

  it('injects the nonce into every placeholder and nothing else', () => {
    const html =
      '<script nonce="{{NONCE}}" type="module">x</script><p>{{NONCE}}</p>';
    const out = injectFixtureNonce(html, 'n0nc3');
    expect(out).toBe('<script nonce="n0nc3" type="module">x</script><p>n0nc3</p>');
    expect(out).not.toContain(CSP_NONCE_PLACEHOLDER);
  });

  it('leaves HTML without placeholders byte-identical', () => {
    const html = '<!doctype html><html><body>plain</body></html>';
    expect(injectFixtureNonce(html, 'n0nc3')).toBe(html);
  });

  it('exposes stable fixture/report routes used by the server and the spec', () => {
    expect(CSP_FIXTURE_PATH).toBe('/e2e/csp-fixture.html');
    expect(CSP_REPORT_PATH).toBe('/e2e/csp-report');
    expect(CSP_REPORTS_PATH).toBe('/e2e/csp-reports');
    expect(buildReportingEndpointsHeader()).toBe(`csp="${CSP_REPORT_PATH}"`);
    expect(CSP_POLICY_NAME).toBe('zenith');
  });
});
