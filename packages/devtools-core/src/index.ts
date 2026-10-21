// packages/devtools-core/src/index.ts
//
// #147 — @zenith/devtools-core (SPEC §۲.۷، لایهٔ L1):
//   • اتصال به @zenith/state از طریق تنها نقطهٔ hook (`setSignalObserver`).
//   • رجیستری واحد Signal با شناسهٔ رشته‌ای (`sig-1`, `sig-2`, ...) و WeakRef + FinalizationRegistry.
//   • Timeline، اشتراک تغییرات (`onStateChange`)، فیلتر redact، sampleRate و captureValues.
//   • Time-travel: `snapshot()`, `restore(snap)`, `replay(from, to, { speed })`.
//   • گراف زمان اجرا: `RuntimeGraph` (با alias سازگار `DependencyGraph`).
//   • رجیستری پنل: `registerCache`, `registerStore`, `registerApp`.
//   • Hook نسخه‌دار روی `globalThis.__ZENITH_DEVTOOLS_HOOK__` با `{ version, emit, on }` و خطاهای ZEN-2401 / ZEN-2402.

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
  type GraphSignalOptions,
  type GraphDirectiveOptions,
  type GraphNode,
  type GraphEdge,
  type GraphSnapshot,
  type GraphNodeType,
  type GraphEdgeType,
} from './graph';

export {
  DEVTOOLS_HOOK_VERSION,
  type DevtoolsCoreOptions,
  devtoolsCoreOptions,
  DEVTOOLS_CORE_DEFAULTS,
  devtoolsCoreOptionsSchema,
  resolveDevtoolsCoreOptions,
} from './core-options';
export type {
  UntypedSignal,
  SignalInfo,
  StateChange,
  SnapshotSignalEntry,
  Snapshot,
  DevtoolsHookEventMap,
  ZenithDevtoolsCoreHook,
} from './core-types';
export {
  hook,
  assertHookVersion,
  registerSignal,
  nameSignal,
  recordStateChange,
  getAllSignals,
  getSignalInfo,
  getTimeline,
  getStateTimeline,
  onStateChange,
  clearRegistry,
  clearDevtoolsRegistryInternal,
  clearDevtoolsRegistry,
} from './core-registry';
export { snapshot, restore, replay } from './core-timetravel';
export {
  registerDevtoolsCache,
  getRegisteredCaches,
  registerDevtoolsStore,
  getRegisteredStores,
  registerApp,
  getRegisteredApps,
} from './core-panels';
export {
  installDevtoolsCore,
  registerCache,
  registerStore,
} from './core-install';
