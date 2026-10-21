// #90 — Web Vitals in a REAL browser (Chromium-only): LCP ≤ 2.5s, CLS ≤ 0.1
// and INP ≤ 200ms under the shared mobile-4G / 4x-CPU profile, 5 predefined
// runs per demo. INP comes from a SCRIPTED INTERACTION FLOW (real buttons /
// inputs / in-demo navigation) measured through Event Timing — never TBT,
// never a hardcoded zero: a run with no observed interaction timing FAILS
// explicitly. LCP/CLS/Performance are additionally gated by LHCI
// (lighthouserc.cjs); this spec owns INP plus per-run artifacts.
//
// Chromium-only by design (explicit skip below): Event Timing `event`
// entries and CDP CPU/network throttling do not exist elsewhere, and LHCI
// runs Chromium too.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { attachDiags } from './helpers';

// Keep in sync with scripts/web-vitals-budgets.cjs — pinned by
// scripts/test/web-vitals-budgets.test.mjs (spec text must carry these).
const LCP_MS = 2500;
const INP_MS = 200;
const CLS = 0.1;
const RUNS = 5;
const CPU_THROTTLING_RATE = 4;
const NETWORK_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: 1638 * 1024,
  uploadThroughput: 750 * 1024,
};

const DEMOS = [
  { name: 'ecommerce', url: '/ecommerce-demo/index.html' },
  { name: 'dashboard', url: '/dashboard/index.html' },
];

type VitalEntry = { startTime: number };
type ClsEntry = number;
type EventEntry = { duration: number; interactionId: number; name: string };
type VitalsSnapshot = {
  lcp: VitalEntry[];
  cls: ClsEntry[];
  events: EventEntry[];
  error?: string;
};

type Action = { kind: string; target: string; real: boolean };

function p98(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.98 * sorted.length) - 1)];
}

/** INP ≈ p98 of per-interaction worst durations (Event Timing). */
function computeInp(events: EventEntry[]): number | null {
  const byInteraction = new Map<number, number>();
  for (const e of events) {
    if (!e.interactionId) continue;
    byInteraction.set(e.interactionId, Math.max(byInteraction.get(e.interactionId) ?? 0, e.duration));
  }
  return p98([...byInteraction.values()]);
}

const OBSERVER_INIT = `(() => {
  window.__ZENITH_VITALS__ = { lcp: [], cls: [], events: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__ZENITH_VITALS__.lcp.push({ startTime: e.startTime });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__ZENITH_VITALS__.cls.push(e.value);
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.interactionId) window.__ZENITH_VITALS__.events.push({ duration: e.duration, interactionId: e.interactionId, name: e.name });
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (err) {
    window.__ZENITH_VITALS__.error = String(err);
  }
})();`;

async function readVitals(page: { evaluate: <T>(fn: () => T) => Promise<T> }): Promise<VitalsSnapshot> {
  return page.evaluate(
    () =>
      (window as unknown as { __ZENITH_VITALS__: VitalsSnapshot }).__ZENITH_VITALS__ ?? {
        lcp: [],
        cls: [],
        events: [],
        error: 'observers never installed',
      },
  );
}

for (const demo of DEMOS) {
  for (let run = 1; run <= RUNS; run++) {
    test(
      `${demo.name} run ${run}/${RUNS}: LCP/CLS/INP within budget under 4x-CPU/4G`,
      async ({ page, browserName }, testInfo) => {
        test.skip(
          browserName !== 'chromium',
          'INP/Event Timing + CDP throttling are Chromium-only; LHCI runs Chromium too',
        );
        const diags = attachDiags(page);
        const actions: Action[] = [];

        // Shared profile: 4x CPU + 4G network via CDP (same numbers as LHCI).
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLING_RATE });
        await cdp.send('Network.emulateNetworkConditions', NETWORK_4G);

        await page.addInitScript(OBSERVER_INIT);
        await page.goto(demo.url, { waitUntil: 'load' });
        // Documented settle so late LCP candidates still land in the buffer.
        await page.waitForTimeout(2000);

        // Scripted interaction flow — real controls first. Every step is
        // recorded; a run with zero REAL control interactions fails instead
        // of reporting a hollow INP.
        const buttons = page.locator('button:visible:enabled');
        const clicked = Math.min(await buttons.count(), 2);
        for (let i = 0; i < clicked; i++) {
          const label = ((await buttons.nth(i).textContent()) ?? '').trim().slice(0, 40);
          await buttons.nth(i).click({ timeout: 10_000 });
          actions.push({ kind: 'click-button', target: label || `button#${i}`, real: true });
          await page.waitForTimeout(400);
        }
        const inputs = page.locator('input:visible:enabled[type="text"], input:visible:enabled:not([type]), input:visible:enabled[type="search"]');
        if ((await inputs.count()) > 0) {
          await inputs.first().fill('zenith');
          actions.push({ kind: 'fill-input', target: 'first-text-input', real: true });
          await page.keyboard.press('Enter');
          await page.waitForTimeout(400);
        }

        // Guaranteed timing anchor: a click on static content always produces
        // an Event Timing entry, so INP is measurable even on pages whose
        // only real controls navigate away (flagged real:false).
        await page.locator('main h1, main h2, h1').first().click({ timeout: 10_000 }).catch(() => {});
        actions.push({ kind: 'click-heading-anchor', target: 'first-heading', real: false });

        // Snapshot the first view BEFORE any navigation (navigation wipes the
        // in-page buffer); observers re-install automatically post-navigation.
        const firstView = await readVitals(page);

        // In-demo navigation exercises the SPA router as a genuine interaction.
        const links = page.locator('a:visible[href^="/"]');
        if ((await links.count()) > 0) {
          const href = await links.first().getAttribute('href');
          await links.first().click({ timeout: 10_000 });
          actions.push({ kind: 'click-link', target: href ?? 'first-link', real: true });
          await page.waitForLoadState('load').catch(() => {});
          await page.waitForTimeout(2000);
        }
        // Scroll pass: part of the honest session CLS, not excluded.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        const secondView = await readVitals(page);
        const lcpMs =
          firstView.lcp.length + secondView.lcp.length === 0
            ? null
            : Math.max(
                ...firstView.lcp.map((e) => e.startTime),
                ...secondView.lcp.map((e) => e.startTime),
              );
        const clsValue =
          [...firstView.cls, ...secondView.cls].reduce((a, b) => a + b, 0) || 0;
        const inpMs = computeInp([...firstView.events, ...secondView.events]);

        const realActions = actions.filter((a) => a.real);
        const failures: string[] = [];
        if (realActions.length === 0) {
          failures.push('no-real-interaction (page exposes no button/input/link — not a pass)');
        }
        if (lcpMs === null) failures.push('lcp-missing');
        else if (lcpMs > LCP_MS) failures.push(`lcp ${Math.round(lcpMs)}ms > ${LCP_MS}ms`);
        if (inpMs === null) {
          failures.push('inp-missing (no interaction timing observed — not a pass)');
        } else if (inpMs > INP_MS) {
          failures.push(`inp ${Math.round(inpMs)}ms > ${INP_MS}ms`);
        }
        if (!(clsValue <= CLS)) failures.push(`cls ${clsValue.toFixed(3)} > ${CLS}`);

        writeFileSync(
          testInfo.outputPath(`vitals-${demo.name}-run${run}.json`),
          `${JSON.stringify(
            {
              demo: demo.name,
              run,
              profile: { cpuThrottlingRate: CPU_THROTTLING_RATE, network: '4G', browser: browserName },
              actions,
              firstView: { lcpEntries: firstView.lcp.length, clsEntries: firstView.cls.length, eventEntries: firstView.events.length },
              secondView: { lcpEntries: secondView.lcp.length, clsEntries: secondView.cls.length, eventEntries: secondView.events.length },
              summary: { lcpMs, inpMs, cls: clsValue },
              failures,
              diags,
            },
            null,
            2,
          )}\n`,
        );

        expect(failures, `web-vitals failures (${demo.name} run ${run}): ${failures.join('; ')}`).toEqual([]);
      },
      { timeout: 120_000 },
    );
  }
}
