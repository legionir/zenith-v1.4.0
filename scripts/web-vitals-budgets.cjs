// scripts/web-vitals-budgets.cjs
// #90 — Web Vitals budgets and the shared measurement profile (CommonJS so
// BOTH lighthouserc.cjs (require) and the vitest consistency suite (import)
// read the SAME numbers — no drift between the LHCI gate and the Playwright
// INP gate). The Playwright spec (TypeScript ESM) cannot require() this file,
// so scripts/test/web-vitals-budgets.test.mjs asserts the spec text carries
// the identical values.
//
// Profile (acceptance): production build, fixed data, 4x CPU slowdown, 4G
// network — Moto G4 class, identical for LHCI and the Playwright gate.
// Thresholds (acceptance): LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1,
// Lighthouse Performance ≥ 90 — for BOTH demos, every one of the 5
// predefined runs (no best-run cherry-picking).
'use strict';

const BUDGETS = Object.freeze({
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
  performanceScore: 0.9,
  /** Predefined independent runs — fixed before seeing any result. */
  runs: 5,
});

/** Mobile 4G + 4x CPU profile shared by LHCI and the Playwright CDP setup. */
const PROFILE = Object.freeze({
  cpuThrottlingRate: 4,
  /** Lighthouse devtools-throttling units (also the LHCI settings shape). */
  rttMs: 150,
  throughputKbps: 1638,
  /** Same profile in CDP units (bytes/sec) for Network.emulateNetworkConditions. */
  downloadThroughputBps: 1638 * 1024,
  uploadThroughputBps: 750 * 1024,
  latencyMs: 150,
});

/** The two gated demo pages (served by scripts/e2e-server.mjs). */
const VITAL_URLS = Object.freeze([
  'http://127.0.0.1:8089/ecommerce-demo/index.html',
  'http://127.0.0.1:8089/dashboard/index.html',
]);

/** Median of a non-empty numeric sample (pre-specified aggregation). */
function summarizeRuns(values) {
  const sorted = [...values].filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error('web-vitals: cannot summarize an empty sample');
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pure pass/fail over one measured page view. `inpMs: null` means "no
 * interaction timing was observed" — that FAILS explicitly: a missing INP
 * must never be reported as INP = 0 (acceptance: TBT is not INP, and an
 * interaction-less run is not a passing run).
 */
function checkVitals({ lcpMs, inpMs, cls }) {
  const failures = [];
  if (!(typeof lcpMs === 'number' && Number.isFinite(lcpMs))) {
    failures.push('lcp-missing');
  } else if (lcpMs > BUDGETS.lcpMs) {
    failures.push(`lcp ${Math.round(lcpMs)}ms > ${BUDGETS.lcpMs}ms`);
  }
  if (inpMs === null || inpMs === undefined) {
    failures.push('inp-missing (no interaction timing observed — not a pass)');
  } else if (!(typeof inpMs === 'number' && Number.isFinite(inpMs))) {
    failures.push('inp-missing (no interaction timing observed — not a pass)');
  } else if (inpMs > BUDGETS.inpMs) {
    failures.push(`inp ${Math.round(inpMs)}ms > ${BUDGETS.inpMs}ms`);
  }
  if (!(typeof cls === 'number' && Number.isFinite(cls))) {
    failures.push('cls-missing');
  } else if (cls > BUDGETS.cls) {
    failures.push(`cls ${cls} > ${BUDGETS.cls}`);
  }
  return { pass: failures.length === 0, failures };
}

module.exports = { BUDGETS, PROFILE, VITAL_URLS, summarizeRuns, checkVitals };
