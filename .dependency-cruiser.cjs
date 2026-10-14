// Dependency-cruiser config for CI (#79 dependency stage + #48 reverse-dep removal + #49 L0-L5 architecture layers).
// See docs/ARCHITECTURE-LAYERS.md for the formal layer map.

const L0 = 'errors|shared|logger|cache|jalali|storage|schema|scheduler|security';
const L1 = 'state|expressions|dependency-graph|devtools-core';
const L2 =
  'router|events|components|resource|data|http|actions|auth|permission|store|form|notifications|error-boundary|suspense|transition|virtual-list|data-table|i18n|a11y|head|ui|realtime|analytics|theme|auth-oauth|feature-flags|charts|icons';
const L3 = 'runtime-core|runtime|ssr';
const L4 = 'stateful|crud|service-worker|devtools|testing|adapter-node|adapter-edge|ssg';
const L5 = 'zenith';
const TOOLING =
  'compiler|vite-plugin|cli|vscode-extension|unplugin-zenith|create-zenith|eslint-plugin|language-server|codemod|mock|testing-e2e';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Static import cycles between sources are forbidden (#79).',
      from: { pathNot: '^packages/vscode-extension/' },
      to: { circular: true },
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment: 'Source files must not depend on devDependencies.',
      from: { path: '^packages/[^/]+/src', pathNot: '\\.d\\.ts$' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    // ── #48: Explicit forbidden reverse/unrelated dependencies ──
    {
      name: 'no-events-to-router',
      severity: 'error',
      comment:
        '#48: @zenith/events must not depend on @zenith/router (use setLinkNavigationHandler).',
      from: { path: '^packages/events/src' },
      to: { path: '^packages/router/' },
    },
    {
      name: 'no-state-to-devtools',
      severity: 'error',
      comment:
        '#48/#147: @zenith/state must not depend on @zenith/devtools or @zenith/devtools-core.',
      from: { path: '^packages/state/src' },
      to: { path: '^packages/(devtools|devtools-core)/' },
    },
    {
      name: 'no-runtime-to-i18n',
      severity: 'error',
      comment:
        '#48/#146: @zenith/runtime and @zenith/runtime-core must not depend on @zenith/i18n.',
      from: { path: '^packages/(runtime|runtime-core)/src' },
      to: { path: '^packages/i18n/' },
    },
    // ── #49: Architectural layer boundaries (L0 -> L5 + Tooling) ──
    {
      name: 'layer-l0-no-upward',
      severity: 'error',
      comment: '#49: L0 foundation packages must only depend on L0 packages.',
      from: { path: `^packages/(${L0})/src` },
      to: { path: `^packages/(${L1}|${L2}|${L3}|${L4}|${L5}|${TOOLING})/` },
    },
    {
      name: 'layer-l1-no-upward',
      severity: 'error',
      comment: '#49: L1 reactivity packages must only depend on L0 or L1 packages.',
      from: { path: `^packages/(${L1})/src` },
      to: { path: `^packages/(${L2}|${L3}|${L4}|${L5}|${TOOLING})/` },
    },
    {
      name: 'layer-l2-no-upward',
      severity: 'error',
      comment: '#49: L2 capability packages must only depend on L0, L1, or L2 packages.',
      from: { path: `^packages/(${L2})/src` },
      to: { path: `^packages/(${L3}|${L4}|${L5}|${TOOLING})/` },
    },
    {
      name: 'layer-l3-no-upward',
      severity: 'error',
      comment:
        '#49: L3 runtime/ssr packages must not depend on L4, L5, or Tooling (except legacy @zenith/runtime -> @zenith/devtools compat re-export).',
      from: { path: `^packages/(${L3})/src` },
      to: {
        path: `^packages/(${L4}|${L5}|${TOOLING})/`,
        pathNot: '^packages/devtools/',
      },
    },
    {
      name: 'layer-runtime-core-no-devtools',
      severity: 'error',
      comment: '#49/#148: @zenith/runtime-core (L3) must not depend on @zenith/devtools (L4).',
      from: { path: '^packages/(runtime-core|ssr)/src' },
      to: { path: '^packages/devtools/' },
    },
    {
      name: 'layer-l4-no-upward',
      severity: 'error',
      comment: '#49: L4 packages must not depend on L5 (zenith) or Tooling packages.',
      from: { path: `^packages/(${L4})/src` },
      to: { path: `^packages/(${L5}|${TOOLING})/` },
    },
    {
      name: 'no-runtime-to-tooling',
      severity: 'error',
      comment: '#49: Runtime packages (L0-L5) must never depend on build/IDE Tooling packages.',
      from: { path: `^packages/(${L0}|${L1}|${L2}|${L3}|${L4}|${L5})/src` },
      to: { path: `^packages/(${TOOLING})/` },
    },
  ],
  options: {
    includeOnly: '^packages/[^/]+/src',
    exclude: { dynamic: true },
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.eslint.json' },
    tsPreCompilationDeps: false,
    moduleSystems: ['cjs', 'es6', 'tsd'],
    progress: { type: 'none' },
  },
};
