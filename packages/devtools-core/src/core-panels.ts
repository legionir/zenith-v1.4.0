// packages/devtools-core/src/core-panels.ts
//
// رجیستری پنل‌های DevTools (cache/store/app) — استخراج مکانیکی از index.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import type { Cleanup } from '@zenith/shared';
import {
  isSSRContext,
  noopCleanup,
  registeredApps,
  registeredCaches,
  registeredStores,
} from './core-state';


// ── Panel Registries (`registerCache`, `registerStore`, `registerApp`) ──

// Replacement and reset release old payloads; equal values are not equal leases.
function registerPanel(registry: Map<string, PanelRegistration>, name: string, value: unknown): Cleanup {
  if (isSSRContext()) return noopCleanup;
  const old = registry.get(name); if (old) old.value = undefined;
  const entry: PanelRegistration = { value }; registry.set(name, entry);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registry.get(name) === entry) registry.delete(name);
    entry.value = undefined;
  };
}
function readPanels(registry: Map<string, PanelRegistration>): ReadonlyMap<string, unknown> {
  const view = new Map<string, unknown>();
  if (!isSSRContext()) for (const [name, entry] of registry) view.set(name, entry.value);
  return view;
}

/** @public */
export function registerDevtoolsCache(name: string, cache: unknown): Cleanup {
  return registerPanel(registeredCaches, name, cache);
}
/** @public */
export function getRegisteredCaches(): ReadonlyMap<string, unknown> {
  return readPanels(registeredCaches);
}
/** @public */
export function registerDevtoolsStore(name: string, store: unknown): Cleanup {
  return registerPanel(registeredStores, name, store);
}
/** @public */
export function getRegisteredStores(): ReadonlyMap<string, unknown> {
  return readPanels(registeredStores);
}
/** @public */
export function registerApp(name: string, app: unknown): Cleanup {
  return registerPanel(registeredApps, name, app);
}
/** @public */
export function getRegisteredApps(): ReadonlyMap<string, unknown> {
  return readPanels(registeredApps);
}