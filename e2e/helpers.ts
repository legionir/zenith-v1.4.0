// e2e diagnosability helpers (#79/CI): ready-flag waits MUST surface what the
// page actually did when they time out. A bare waitForFunction timeout sits in
// front of a console error, a failed module import, or a pageerror that the
// text assertions never reach — this helper captures all of those eagerly and
// folds them into the thrown error message so CI logs tell the real story.
import type { Page } from '@playwright/test';

export type PageDiags = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
};

export function attachDiags(page: Page): PageDiags {
  const diags: PageDiags = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on('pageerror', (err) => diags.pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') diags.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) =>
    diags.failedRequests.push(`${req.failure()?.errorText ?? '?'} ${req.url()}`),
  );
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      diags.failedRequests.push(`HTTP ${status} ${res.url()}`);
    }
  });
  return diags;
}

function describe(diags: PageDiags): string {
  const parts: string[] = [];
  if (diags.pageErrors.length) parts.push(`pageerror: ${diags.pageErrors.join(' | ')}`);
  if (diags.consoleErrors.length) parts.push(`console: ${diags.consoleErrors.join(' | ')}`);
  if (diags.failedRequests.length) parts.push(`requests: ${diags.failedRequests.join(' | ')}`);
  return parts.length > 0 ? parts.join(' // ') : '(no page errors captured)';
}

/**
 * Wait for a `window.__ZENITH_*_READY__` flag. On timeout, throws an error that
 * includes ALL captured page errors/console messages/failed requests — so the
 * root cause (module import failure, CSP, 404…) appears directly in CI output.
 */
export async function waitReady(page: Page, flag: string, diags: PageDiags): Promise<void> {
  try {
    await page.waitForFunction((name) => (window as any)[name] === true, flag);
  } catch (err) {
    // One last snapshot AFTER the timeout — the flag might have flipped late,
    // and any late-arriving console entry must be visible too.
    const flagValue = await page.evaluate((name) => (window as any)[name], flag).catch(() => null);
    throw new Error(
      `READY flag "${flag}" never became true (final value: ${String(flagValue)}). Page diagnostics: ${describe(diags)}`,
    );
  }
}
