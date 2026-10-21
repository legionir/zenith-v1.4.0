// packages/zenith/src/core.ts
//
// `zenith/core`: `@zenith/runtime-core` + `@zenith/state` + `watch` (#149, SPEC §2.9).

/** @public */
export {
  createApp,
  defineDirective,
  definePlugin,
  onMount,
  onUnmount,
  onUpdate,
  provide,
  inject,
  useApp,
  hydrate,
  startFromSSR,
  assertCompatible,
  APP_OPTIONS_DEFAULTS,
  appOptionsSchema,
  ZENITH_RUNTIME_CORE_VERSION,
  type App,
  type AppOptions,
  type BindContext,
  type DirectiveDefinition,
  type HydrationMismatch,
  type HydrationResult,
  type Plugin,
} from '@zenith/runtime-core';

/** @public */
export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  isReadable,
  isWritable,
  Signal,
  Computed,
  type ReadonlySignal,
  type MaybeSignal,
} from '@zenith/state';

/** @public */
export { flushSync, scheduleEffect } from '@zenith/scheduler';
/** @public */
export { watch, type WatchOptions, type WatchSource } from './watch';
