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

export {
  initDevTools,
  getDevtoolsVersion,
  isDevtoolsHookInstalled,
  cleanupDevtools,
  DEVTOOLS_VERSION,
  type ZenithDevtoolsHook,
} from './hook';

// FEATURE (v0.4.0): Dependency Graph Viewer
// API گراف وابستگی‌ها (Signal → Effect → Directive → DOM) برای استفاده‌ی
// مستقیم در تست‌ها یا ابزارهای داخلی. در runtime، از طریق window.__ZENITH__
// هم در دسترس است.
export {
  DependencyGraph,
  graph,
  getDependencyGraph,
  clearDependencyGraph,
  recordRead,
  recordWrite,
  recordDomUpdate,
  type GraphNode,
  type GraphEdge,
  type GraphSnapshot,
  type GraphNodeType,
  type GraphEdgeType,
} from './graph';
