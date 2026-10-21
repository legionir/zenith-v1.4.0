// #63 — strict CSP + TrustedTypes in a REAL browser: the fixture is served
// with an ENFORCED Content-Security-Policy response header (per-response
// CSPRNG nonce, no unsafe-eval/unsafe-inline, require-trusted-types-for
// 'script') and the gate fails on ANY securitypolicyviolation. A
// deliberate-violation mode (?violate=1) proves the gate actually trips — a
// harness that can never fail would pass vacuously.
import { test, expect } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

type CspResults = {
  ttSupported: boolean;
  ttBlockedRawSink: boolean | null;
  ttEnforced: boolean;
  controlFired: boolean;
  sanitizedRendered: boolean;
  xssBlocked: boolean;
  scriptNonce: string | null;
  violationCount: number;
};

type CspViolation = {
  blockedURI: string;
  violatedDirective: string;
  effectiveDirective: string;
};

async function serverReports(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}): Promise<CspViolation[]> {
  return (await (await request.get('/e2e/csp-reports')).json()) as CspViolation[];
}

test.beforeEach(async ({ request }) => {
  await request.delete('/e2e/csp-reports');
});

test('strict page renders with zero CSP violations', async ({ page, request }) => {
  const diags = attachDiags(page);

  const response = await page.goto('/e2e/csp-fixture.html');
  expect(response?.ok()).toBe(true);

  // The policy must be an enforced response header — not report-only, not meta.
  const header = response?.headers()['content-security-policy'] ?? '';
  expect(header).toContain(`require-trusted-types-for 'script'`);
  expect(header).toContain('trusted-types zenith');
  expect(header).toContain(`'strict-dynamic'`);
  expect(header).not.toContain('unsafe-inline');
  expect(header).not.toContain('unsafe-eval');
  const headerNonce = /'nonce-([^']+)'/.exec(header)?.[1];
  expect(headerNonce, 'response header carries a nonce').toBeTruthy();

  await waitReady(page, '__ZENITH_CSP_READY__', diags);

  const results = await page.evaluate(
    () => (window as unknown as { __ZENITH_CSP_RESULTS__: CspResults }).__ZENITH_CSP_RESULTS__,
  );
  // The executed script's nonce must be the header nonce (header↔HTML match).
  expect(results.scriptNonce).toBe(headerNonce);
  // The real product path works: policy-backed sanitized render…
  expect(results.sanitizedRendered).toBe(true);
  // …and the XSS payload did not execute.
  expect(results.xssBlocked).toBe(true);
  // No in-page violation event fired.
  expect(results.violationCount).toBe(0);

  // Trusted Types capability is reported explicitly: Chromium enforces the
  // raw-sink block, other engines record lack of support instead of faking it.
  expect(typeof results.ttSupported).toBe('boolean');
  if (test.info().project.name === 'chromium') {
    expect(results.ttSupported).toBe(true);
    expect(results.ttEnforced).toBe(true);
    // Under enforcement even the positive control cannot run raw — recorded,
    // not hidden: the sanitized path above is the enforced-mode proof.
    expect(results.controlFired).toBe(false);
  } else {
    expect(results.controlFired).toBe(true);
  }

  // Negative assertions need a settle window so a LATE violation/report would
  // still be caught instead of racing the assertion.
  await page.waitForTimeout(1000);
  expect(await serverReports(request)).toEqual([]);
  expect(diags.pageErrors).toEqual([]);
  expect(
    diags.consoleErrors.filter((m) => /content security policy|trustedtype/i.test(m)),
    `CSP console noise: ${diags.consoleErrors.join(' | ')}`,
  ).toEqual([]);
});

test('deliberate violation trips the gate (negative control)', async ({
  page,
  request,
}) => {
  const diags = attachDiags(page);

  await page.goto('/e2e/csp-fixture.html?violate=1');
  await waitReady(page, '__ZENITH_CSP_READY__', diags);

  // The nonce-less script must NOT have executed…
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __ZENITH_CSP_FORCED_VIOLATION__?: boolean })
          .__ZENITH_CSP_FORCED_VIOLATION__,
    ),
  ).toBeUndefined();

  // …and the violation must be observable in-page…
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __ZENITH_CSP_VIOLATIONS__: CspViolation[] })
              .__ZENITH_CSP_VIOLATIONS__.length,
        ),
      { timeout: 4000 },
    )
    .toBeGreaterThan(0);

  // …AND at the server reporting endpoint (proves the reporting channel works).
  await expect
    .poll(async () => (await serverReports(request)).length, { timeout: 6000 })
    .toBeGreaterThan(0);
});
