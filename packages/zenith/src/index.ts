// packages/zenith/src/index.ts
//
// `zenith` umbrella package (L5 — SPEC §2.9, #149):
// - Core primitives (`createApp`, `defineDirective`, `definePlugin`, `signal`, `computed`, `effect`, `batch`, `watch`)
// - `createZenith({ preset?, plugins?, ...AppOptions }) => App`
// - `assertCompatible() => void` (`ZEN-2320` lockstep version enforcement)
// - Single-source namespaces (`export * as http`, `router`, `store`, `form`, `i18n`, ...)
//   Never exports colliding names (`clearCache`, `alert`, ...) at top-level.

import {
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
  assertCompatible as assertCoreCompatible,
  APP_OPTIONS_DEFAULTS,
  ZENITH_RUNTIME_CORE_VERSION,
  type App,
  type AppOptions,
  type BindContext,
  type DirectiveDefinition,
  type HydrationMismatch,
  type HydrationResult,
  type Plugin,
} from '@zenith/runtime-core';
import { createReservedError, ZenithError } from '@zenith/errors';
import { s, defineOptions } from '@zenith/schema';
import {
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
import { flushSync, scheduleEffect } from '@zenith/scheduler';
import { watch, type WatchOptions, type WatchSource } from './watch';
import { minimalPreset } from './presets/minimal';
import { spaPreset } from './presets/spa';
import { fullPreset } from './presets/full';

/** @public */
export type ZenithPresetName = 'minimal' | 'spa' | 'full';

/** @public */
export interface ZenithOptions extends AppOptions {
  /** Preset bundle to install on the created app (default: `'minimal'`). */
  preset?: ZenithPresetName;
}

/** @public */
export const ZENITH_VERSION = '1.5.0';

/** @public */
export const ZENITH_OPTIONS_DEFAULTS = /* @__PURE__ */ Object.freeze({
  state: /* @__PURE__ */ Object.freeze({}),
  plugins: /* @__PURE__ */ Object.freeze([]),
  devtools: true,
  strictParity: false,
  idPrefix: 'zen',
  ssr: /* @__PURE__ */ Object.freeze({ preloadState: true, validateHydration: false }),
  preset: 'minimal' as ZenithPresetName,
});

const ZenithPresetSchema = /* @__PURE__ */ s.enum(['minimal', 'spa', 'full'] as const);

/** @public */
export const LOCKSTEP_PACKAGES: Readonly<Record<string, string>> = /* @__PURE__ */ Object.freeze({
  zenith: ZENITH_VERSION,
  '@zenith/runtime-core': ZENITH_RUNTIME_CORE_VERSION,
  '@zenith/state': ZENITH_VERSION,
  '@zenith/scheduler': ZENITH_VERSION,
  '@zenith/errors': ZENITH_VERSION,
  '@zenith/shared': ZENITH_VERSION,
  '@zenith/schema': ZENITH_VERSION,
  '@zenith/security': ZENITH_VERSION,
  '@zenith/events': ZENITH_VERSION,
  '@zenith/router': ZENITH_VERSION,
  '@zenith/http': ZENITH_VERSION,
  '@zenith/resource': ZENITH_VERSION,
  '@zenith/store': ZENITH_VERSION,
  '@zenith/form': ZENITH_VERSION,
  '@zenith/i18n': ZENITH_VERSION,
  '@zenith/error-boundary': ZENITH_VERSION,
  '@zenith/notifications': ZENITH_VERSION,
});

/**
 * Verify that all loaded `@zenith/*` packages match the lockstep version (`1.5.0`).
 * Throws `ZEN-2320` (`ZenithError`) on any version mismatch.
 */
/** @public */
export function assertCompatible(overrides?: Record<string, string>): void {
  assertCoreCompatible(overrides);
  const versions: Record<string, string> = {
    ...LOCKSTEP_PACKAGES,
    ...(overrides ?? {}),
  };
  for (const [pkg, ver] of Object.entries(versions)) {
    if (ver !== ZENITH_VERSION) {
      throw createReservedError('ZEN-2320', {
        details: {
          package: 'zenith',
          expected: ZENITH_VERSION,
          actual: `${pkg}@${ver}`,
        },
      });
    }
  }
}

let cachedPresetContract: ReturnType<typeof defineOptions<{ preset: ZenithPresetName }>> | null =
  null;
function getPresetOptionContract() {
  if (!cachedPresetContract) {
    cachedPresetContract = defineOptions(
      'ZenithPresetOptions',
      s.object({
        preset: s.default(ZenithPresetSchema, 'minimal' as ZenithPresetName),
      }),
    );
  }
  return cachedPresetContract;
}

/**
 * Create a Zenith `App` configured with a preset (`'minimal' | 'spa' | 'full'`, default `'minimal'`)
 * and any additional `AppOptions` (`state`, `plugins`, `strictParity`, ...).
 */
/** @public */
export function createZenith(options?: ZenithOptions): App {
  const contract = getPresetOptionContract();
  if (
    options !== undefined &&
    (typeof options !== 'object' || options === null || Array.isArray(options))
  ) {
    contract.resolve(options);
  }
  const { preset = ZENITH_OPTIONS_DEFAULTS.preset, plugins = [], ...appOptions } = options ?? {};
  contract.resolve({ preset });

  const presetPlugin: Plugin =
    preset === 'full' ? fullPreset : preset === 'spa' ? spaPreset : minimalPreset;

  return createApp({
    ...appOptions,
    plugins: [presetPlugin, ...plugins],
  });
}

// ── Core & Reactive Top-Level Exports (Single-Source Rule) ──
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
  APP_OPTIONS_DEFAULTS,
  ZENITH_RUNTIME_CORE_VERSION,
  ZenithError,
  signal,
  computed,
  effect,
  batch,
  untrack,
  isReadable,
  isWritable,
  Signal,
  Computed,
  watch,
  flushSync,
  scheduleEffect,
  minimalPreset,
  spaPreset,
  fullPreset,
  type App,
  type AppOptions,
  type BindContext,
  type DirectiveDefinition,
  type HydrationMismatch,
  type HydrationResult,
  type Plugin,
  type ReadonlySignal,
  type MaybeSignal,
  type WatchOptions,
  type WatchSource,
};

// ── Single-Source Namespace Re-exports (L1/L2/L3) ──
/** @public */
export * as actions from '@zenith/actions';
/** @public */
export * as auth from '@zenith/auth';
/** @public */
export * as cache from '@zenith/cache';
/** @public */
export * as components from '@zenith/components';
/** @public */
export * as errorBoundary from '@zenith/error-boundary';
/** @public */
export * as events from '@zenith/events';
/** @public */
export * as form from '@zenith/form';
/** @public */
export * as http from '@zenith/http';
/** @public */
export * as i18n from '@zenith/i18n';
/** @public */
export * as jalali from '@zenith/jalali';
/** @public */
export * as logger from '@zenith/logger';
/** @public */
export * as notifications from '@zenith/notifications';
/** @public */
export * as resource from '@zenith/resource';
/** @public */
export * as router from '@zenith/router';
/** @public */
export * as schema from '@zenith/schema';
/** @public */
export * as security from '@zenith/security';
/** @public */
export * as storage from '@zenith/storage';
/** @public */
export * as store from '@zenith/store';
/** @public */
export * as suspense from '@zenith/suspense';
/** @public */
export * as transition from '@zenith/transition';

/** @public */
export * as a11y from '@zenith/a11y';
/** @public */
export * as head from '@zenith/head';
/** @public */
export * as ui from '@zenith/ui';
