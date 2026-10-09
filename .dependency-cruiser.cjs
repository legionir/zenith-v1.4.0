// Dependency-cruiser config for CI (#79 dependency stage).
// Full layering (upward-dep prevention, per-layer whitelist, orphan policy)
// is #49 scope. This baseline keeps the gate honest and green:
// - no *static* cycles between package sources (dynamic imports are excluded
//   from the graph — packages/components/src/registry.ts deliberately
//   lazy-imports processor.ts, see its comment; a static cycle there would be
//   a real hazard);
// - src must not import devDependencies.
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Static import cycles between sources are forbidden (CI gate #79; layering rules land in #49).',
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
  ],
  options: {
    // Only cruise package sources; tests are covered by vitest/typecheck.
    includeOnly: '^packages/[^/]+/src',
    // Intentional dynamic imports stay out of the cycle graph (see header).
    exclude: { dynamic: true },
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.eslint.json' },
    // Cycle check runs on *post-compilation* deps: type-only imports vanish at
    // build time (esbuild strips them), so e.g. state/registry → signal (type
    // Signal) is not a runtime cycle.
    tsPreCompilationDeps: false,
    moduleSystems: ['cjs', 'es6', 'tsd'],
    progress: { type: 'none' },
  },
};
