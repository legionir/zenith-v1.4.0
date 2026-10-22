// packages/devtools-core/src/core-state.ts
//
// وضعیت داخلی مشترک هستهٔ DevTools — استخراج مکانیکی از index.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).
//
// همهٔ ماژول‌های core-* همین نمونهٔ state را می‌بینند (live binding)؛ ترتیب
// مقداردهی اولیه مثل قبل در همین فایل حفظ شده است.

import { isGlobalDiagnosticsAllowed } from './observation-policy';
import type { Cleanup } from '@zenith/shared';
import { DEVTOOLS_CORE_DEFAULTS } from './core-options';
import type { DevtoolsCoreOptions } from './core-options';
import type {
  SignalInfo,
  StateChange,
  UntypedSignal,
} from './core-types';


// ── وضعیت داخلی ──

export let currentConfig: Required<DevtoolsCoreOptions> = {
  ...DEVTOOLS_CORE_DEFAULTS,
  redact: [...DEVTOOLS_CORE_DEFAULTS.redact],
};

export let signalToId = new WeakMap<UntypedSignal, string>();
export const idToInfo = new Map<string, SignalInfo>();
export let nextSignalSeq = 1;
export let nextChangeSeq = 1;
export const timeline: StateChange[] = [];
export interface StateChangeListener { callback: ((change: StateChange) => void) | null; }
export const stateChangeListeners = new Set<StateChangeListener>();
export const pendingRegistrations = new WeakSet<UntypedSignal>();
export let registryGeneration = 0;
export const restoringOperations = new Set<object>();
// The shared State observer can have several live scoped installations. One
// older disposer must not unpublish the hook still used by another installation.
export const activeInstallations = new Set<object>();

export interface PanelRegistration { value: unknown; }
export const registeredCaches = new Map<string, PanelRegistration>();
export const registeredStores = new Map<string, PanelRegistration>();
export const registeredApps = new Map<string, PanelRegistration>();
export const noopCleanup: Cleanup = () => {};

export const finalizationRegistry: FinalizationRegistry<string> | null =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry<string>((id: string) => {
        idToInfo.delete(id);
      })
    : null;

export function isSSRContext(): boolean { return !isGlobalDiagnosticsAllowed(); }

export function isTrackingEnabled(): boolean {
  if (isSSRContext()) return false;
  const g = globalThis as Record<string, unknown>;
  if (g.__ZENITH_DEVTOOLS__ === false) return false;
  if (g.__ZENITH_DEV__ === false && g.__ZENITH_DEVTOOLS__ !== true && !currentConfig.enabled) {
    return false;
  }
  return currentConfig.enabled;
}

export function formatCapturedValue(val: unknown): unknown {
  if (!currentConfig.captureValues) {
    if (val === null) return '[null]';
    if (Array.isArray(val)) return `[Array(${val.length})]`;
    if (typeof val === 'object') return `[Object(${Object.keys(val as object).length})]`;
    if (typeof val === 'string') return `[string(${val.length})]`;
    return `[${typeof val}]`;
  }
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const redactSet = new Set(currentConfig.redact.map((k: string) => k.toLowerCase()));
  if (redactSet.size === 0) return val;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = redactSet.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

export function cleanupDeadSignals(): void {
  for (const [id, info] of idToInfo) {
    if (info.signalRef.deref() === undefined) {
      idToInfo.delete(id);
    }
  }
}

// ── #40: mutation helpers ──
//
// `nextSignalSeq`/`nextChangeSeq`/`registryGeneration`/`signalToId`/`currentConfig`
// در اصل `let`های همین ماژول بودند و از همان‌جا بازنویسی می‌شدند. چون
// rebinding روی live binding وارداتی در ESM ممنوع است، بازنویسی‌ها فقط از
// همین‌جا انجام می‌شود؛ ماژول‌های مصرف‌کننده این helperها را صدا می‌زنند.
// رفتار عین قبل است (فقط محل دستور عوض شده).

/** شمارهٔ بعدی سیگنال (`sig-N`) را برمی‌گرداند و شمارنده را جلو می‌برد. */
export function allocSignalSeq(): number {
  return nextSignalSeq++;
}

/** شمارهٔ بعدی رخداد (`chg-N`) را برمی‌گرداند و شمارنده را جلو می‌برد. */
export function allocChangeSeq(): number {
  return nextChangeSeq++;
}

/** نسل رجیستری را یک واحد جلو می‌برد (ابطال کارهای خفته). */
export function bumpRegistryGeneration(): void {
  registryGeneration++;
}

/** نگاشت signal→id را با WeakMap تازه جایگزین می‌کند (ریست داخلی). */
export function resetSignalIds(): void {
  signalToId = new WeakMap<UntypedSignal, string>();
}

/** پیکربندی فعلی هسته را جایگزین می‌کند (نصب). */
export function setCurrentConfig(next: Required<DevtoolsCoreOptions>): void {
  currentConfig = next;
}