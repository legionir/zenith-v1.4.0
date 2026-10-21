
// lighthouserc.cjs — LHCI gate for #90 (auto-discovered by `lhci autorun`).
//
// Covers what navigation-mode Lighthouse CAN measure: Performance ≥ 90,
// LCP ≤ 2.5s, CLS ≤ 0.1 — 5 predefined runs per demo on the shared mobile-4G /
// 4x-CPU profile from scripts/web-vitals-budgets.cjs, filesystem artifacts.
// Deliberately NO INP assertion here: navigation-mode Lighthouse observes no
// real interaction, so any INP number it prints would be hollow — INP ≤ 200ms
// with a scripted interaction flow is gated by e2e/web-vitals.spec.ts instead
// (acceptance: TBT must not stand in for INP).
//
// Local run (reference machine, production build, fixed data):
//   npm run build && npx -y @lhci/cli@0.14.0 autorun
// CI job (validation phase): same command on a pinned runner + upload of
// lhci-artifacts/ (the .github workflow is not in this snapshot — see the
// #90 changeset for the job snippet).
const { BUDGETS, PROFILE, VITAL_URLS } = require('./scripts/web-vitals-budgets.cjs');

module.exports = {
  ci: {
    collect: {
      url: [...VITAL_URLS],
      startServerCommand: 'node scripts/e2e-server.mjs',
      startServerReadyPattern: 'e2e static server',
      startServerReadyTimeout: 15000,
      numberOfRuns: BUDGETS.runs,
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 640,
          deviceScaleFactor: 2,
          disabled: false,
        },
        throttlingMethod: 'devtools',
        throttling: {
          rttMs: PROFILE.rttMs,
          throughputKbps: PROFILE.throughputKbps,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
          cpuSlowdownMultiplier: PROFILE.cpuThrottlingRate,
        },
        maxWaitForLoad: 45 * 1000,
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: BUDGETS.performanceScore }],
        'largest-contentful-paint': ['error', { maxNumericValue: BUDGETS.lcpMs }],
        'cumulative-layout-shift': ['error', { maxNumericValue: BUDGETS.cls }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-artifacts',
    },
  },
};
