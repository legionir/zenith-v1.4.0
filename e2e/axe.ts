// axe-core helper for the #99 a11y e2e gate.
// Policy: any violation with impact `serious` or `critical` fails the test, except rules
// listed in ./a11y-allowlist.ts (each entry needs a written justification).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { A11Y_ALLOWLIST } from './a11y-allowlist';

export const FAIL_IMPACTS = ['serious', 'critical'] as const;

export type AxeFinding = { rule: string; impact: string; nodes: string[]; help: string };

/** Never hit the network: demos reference CDN fonts which must not affect results/timing. */
export async function blockExternalRequests(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
}

/** Runs axe (WCAG 2.0/2.1/2.2 A+AA rules) and returns blocking findings for `path`. */
export async function axeFindings(page: Page, path: string): Promise<AxeFinding[]> {
  const allowed = new Set(
    A11Y_ALLOWLIST.filter((e) => e.pages === '*' || e.pages.includes(path)).map((e) => e.rule),
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations
    .filter((v) => (FAIL_IMPACTS as readonly string[]).includes(v.impact ?? ''))
    .filter((v) => !allowed.has(v.id))
    .map((v) => ({
      rule: v.id,
      impact: v.impact ?? '',
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));
}
