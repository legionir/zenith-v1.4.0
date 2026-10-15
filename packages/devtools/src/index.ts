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
  RuntimeGraph,
  DependencyGraph,
  runtimeGraph,
  graph,
  getRuntimeGraph,
  clearRuntimeGraph,
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

export {
  installDevtoolsCore,
  snapshot,
  restore,
  replay,
  hook as devtoolsCoreHook,
  DEVTOOLS_HOOK_VERSION,
} from '@zenith/devtools-core';

// FEATURE (v1.4.0): DevTools Internal API — zero-cost tracking
export {
  devtoolsAPI,
  exposeDevToolsAPI,
  registerPanelSignal,
  registerSignal,
  registerEffect,
  markEffectActive,
  markEffectDisposed,
  recordPanelStateChange,
  recordStateChange,
  type DevToolsAPI,
  type DevToolsSignalInfo,
  type SignalInfo,
  type EffectInfo,
  type ComponentInfo,
  type DevToolsStateChange,
  type StateChange,
} from './api';
