// packages/zenith/src/browser.ts
//
// `zenith/browser` (#149, SPEC §2.9):
// Exposes `window.Zenith` / `globalThis.Zenith` for browser script-tag usage
// (`dist/browser.global.js` with external sourcemap and `.sri` hash).

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
  assertCompatible,
  ZENITH_RUNTIME_CORE_VERSION,
} from '@zenith/runtime-core';
import { signal, computed, effect, batch, untrack } from '@zenith/state';
import { flushSync, scheduleEffect } from '@zenith/scheduler';
import { watch } from './watch';

export const ZenithBrowser = Object.freeze({
  version: ZENITH_RUNTIME_CORE_VERSION,
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
  signal,
  computed,
  effect,
  batch,
  untrack,
  watch,
  flushSync,
  scheduleEffect,
});

/**
 * Install `Zenith` onto the target global object (or `globalThis.window` when in a browser).
 */
export function installBrowserGlobal(
  target: Record<string, unknown> = globalThis as Record<string, unknown>,
): typeof ZenithBrowser {
  target.Zenith = ZenithBrowser;
  return ZenithBrowser;
}

if (
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { window?: unknown }).window !== 'undefined'
) {
  installBrowserGlobal(globalThis as Record<string, unknown>);
}

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
  signal,
  computed,
  effect,
  batch,
  untrack,
  watch,
  flushSync,
  scheduleEffect,
};
