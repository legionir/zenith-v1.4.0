// packages/devtools/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/devtools`.
//
// استفاده در runtime (در حالت Development):
//   import { initDevTools } from '@zenith/devtools';
//   initDevTools();
//
// استفاده در افزونه مرورگر:
//   const hook = window.__ZENITH__;
//   const signals = hook.getSignals();
//   const timeline = hook.getTimeline();
export { initDevTools, getDevtoolsVersion, isDevtoolsHookInstalled, cleanupDevtools, DEVTOOLS_VERSION, } from './hook.js';
// FEATURE (v0.4.0): Dependency Graph Viewer
export { DependencyGraph, graph, getDependencyGraph, clearDependencyGraph, recordRead, recordWrite, recordDomUpdate, } from './graph.js';
//# sourceMappingURL=index.js.map