// packages/actions/src/default-registry.ts
//
// Default singleton + SSR-scoped delegation. Backward-compatible module-level
// API (`registerAction`, `getAction`, …) that delegates to either the shared
// default `ActionRegistry` or a request-scoped one supplied by `@zenith/ssr`.
import { deprecate, onGlobalReset } from '@zenith/errors';
import { ActionRegistry } from './registry';
import type { ActionContext, ActionFn, ActionMetadata, ActionMiddleware } from './types';

// ── Singleton پیش‌فرض — Backward Compatibility ──
//
// پیش از v1.3.0، تمام API های module-level روی یک Map مشترک کار می‌کردند.
// برای حفظ backward compatibility، این API ها به یک نمونه‌ی پیش‌فرض از
// `ActionRegistry` delegate می‌شوند. برنامه‌های جدید می‌توانند با
// `new ActionRegistry()` نمونه‌ی مستقل بسازند.
const _defaultRegistry = new ActionRegistry();

/**
 * #92 — ایزولاسیون رجیستری اکشن‌ها در SSR هم‌زمان.
 * اگر provider توسط `@zenith/ssr` تنظیم شده باشد و یک `ActionRegistry` مخصوص
 * درخواست جاری برگرداند، عملیات ثبت/حذف/پاکسازی (`clearActions` در `Zen.stop`)
 * روی رجیستری درخواست اعمال می‌شود و رجیستری سراسری `_defaultRegistry` دست‌نخورده می‌ماند.
 */
let _actionStoreProvider: (() => ActionRegistry | null) | null = null;

export function setActionRegistryStore(provider: (() => ActionRegistry | null) | null): void {
  _actionStoreProvider = provider;
}

function getActiveActionRegistry(): ActionRegistry {
  return _actionStoreProvider?.() ?? _defaultRegistry;
}

/**
 * ثبت (یا بازنویسی) یک Action روی Registry پیش‌فرض.
 *
 * @param name     نام اکشن — همان رشته‌ای که در HTML نوشته می‌شود.
 * @param fn       تابعی که هنگام رخ دادن رویداد اجرا می‌شود.
 * @param metadata FEATURE (v1.3.0): متادیتای اختیاری برای DevTools.
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که فقط در صورتی
 *           اکشن را حذف می‌کند که هنوز همین تابع ثبت باشد (بازنویسی
 *           بعدی محافظت می‌شود).
 */
export function registerAction(name: string, fn: ActionFn, metadata?: ActionMetadata): () => void {
  const target = getActiveActionRegistry();
  target.register(name, fn, metadata);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (target.get(name) === fn) {
      target.unregister(name);
    }
  };
}

/**
 * حذف یک Action از Registry پیش‌فرض.
 *
 * مفید برای:
 *   - HMR: وقتی ماژول JS دوباره load می‌شود، اکشن قدیمی پاک شود.
 *   - تست‌ها: بین هر test، registry خالی شود.
 */
export function unregisterAction(name: string): boolean {
  return getActiveActionRegistry().unregister(name);
}

/**
 * دریافت Action با نام داده‌شده از Registry پیش‌فرض.
 *
 * @returns تابع یا `undefined` اگر ثبت نشده باشد.
 */
export function getAction(name: string): ActionFn | undefined {
  const scoped = _actionStoreProvider?.();
  if (scoped && scoped.has(name)) {
    return scoped.get(name);
  }
  return _defaultRegistry.get(name);
}

/**
 * FEATURE (v1.3.0): دریافت متادیتای یک Action از Registry پیش‌فرض.
 */
export function getActionMeta(name: string): ActionMetadata | undefined {
  const scoped = _actionStoreProvider?.();
  if (scoped && scoped.has(name)) {
    return scoped.getMeta(name);
  }
  return _defaultRegistry.getMeta(name);
}

/**
 * بررسی وجود Action در Registry پیش‌فرض.
 */
export function hasAction(name: string): boolean {
  const scoped = _actionStoreProvider?.();
  if (scoped && scoped.has(name)) {
    return true;
  }
  return _defaultRegistry.has(name);
}

/**
 * پاکسازی کل Registry پیش‌فرض (فقط برای تست‌ها و teardown کامل).
 *
 * ⚠️ در Production استفاده نکنید — این عملیات تمام اکشن‌های فعال را حذف می‌کند.
 */
export function clearActions(): void {
  deprecate('ZEN-DEPR-054', 'clearActions', 'resetForTesting() (@zenith/testing)');
  clearActionsInternal();
}

/**
 * #118: پاک‌سازی داخلی رجیستری (بدون هشدار) — هوک ریست سراسری به این وصل است
 * تا `resetForTesting()` خودش هشدار deprecation تولید نکند.
 */
export function clearActionsInternal(): void {
  getActiveActionRegistry().clear();
}

// #118: ثبت در رجیستری ریست سراسری (L0) — اجرا با resetForTesting().
/* @__PURE__ */ onGlobalReset(clearActionsInternal);

/**
 * FEATURE (v1.3.0): لیست تمام Action های ثبت‌شده در Registry پیش‌فرض.
 *
 * برای DevTools و documentation generation استفاده می‌شود.
 */
export function listActions(): Array<{ name: string; metadata?: ActionMetadata }> {
  const scoped = _actionStoreProvider?.();
  if (scoped) {
    const merged = new Map<string, { name: string; metadata?: ActionMetadata }>();
    for (const item of _defaultRegistry.list()) merged.set(item.name, item);
    for (const item of scoped.list()) merged.set(item.name, item);
    return Array.from(merged.values());
  }
  return _defaultRegistry.list();
}

/**
 * FEATURE (v1.3.0): دسترسی به نمونه‌ی پیش‌فرض `ActionRegistry`.
 *
 * مفید برای `Zen.start({ registry })` یا برای plugin هایی که می‌خواهند
 * مستقیماً روی registry پیش‌فرض کار کنند.
 */
export function getDefaultRegistry(): ActionRegistry {
  return _defaultRegistry;
}

/**
 * API عمومی برای کاربران: `Zen.action(name, fn)`.
 *
 * معادل `registerAction` است اما با نام کوتاه‌تر برای استفاده‌ی راحت‌تر در HTML.
 * FEATURE (v1.3.0): متدهای `list` و `getMeta` اضافه شدند.
 */
export const action = {
  register: registerAction,
  unregister: unregisterAction,
  has: hasAction,
  clear: clearActions,
  list: listActions,
  getMeta: getActionMeta,
  /**
   * IMP-ACT-01 (v1.3.0): افزودن middleware به default registry.
   *
   * @param mw تابع middleware.
   */
  use: (mw: ActionMiddleware) => _defaultRegistry.use(mw),
  /**
   * IMP-ACT-01 (v1.3.0): اجرای Action از طریق default registry
   * با عبور از middleware pipeline.
   *
   * @param name نام Action.
   * @param ctx  Context اجرا.
   */
  execute: (name: string, ctx: ActionContext) => _defaultRegistry.execute(name, ctx),
};
