// packages/devtools/src/graph.ts
//
// #147 — بازصادرات گراف زمان اجرا از @zenith/devtools-core (SPEC §۲.۷).
// پیاده‌سازی اصلی در @zenith/devtools-core (RuntimeGraph) قرار دارد تا چرخهٔ
// state ↔ devtools شکسته شود و یک گراف واحد در کل فریم‌ورک وجود داشته باشد.

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
} from '@zenith/devtools-core';
