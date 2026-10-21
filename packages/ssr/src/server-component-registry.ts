// packages/ssr/src/server-component-registry.ts
//
// رجیستری ServerComponentها — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).

import { developerError, ErrorCode, deprecate, onGlobalReset } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { createScopedRegistry } from '@zenith/shared';
import type { ServerComponent } from './server-component-types';


// ── REGISTRY ──

/**
 * Registry سراسری از نام → ServerComponent.
 *
 * این registry فقط در سرور استفاده می‌شود (در کلاینت قابل import نیست
 * چون کد render فقط روی سرور اجرا می‌شود). در SSR concurrent، registry
 * بین درخواست‌ها به‌صورت read-only مشترک است — کامپوننت‌ها باید
 * stateless باشند یا state خود را از props بگیرند.
 */
const serverComponentRegistry = createScopedRegistry<ServerComponent>('serverComponents');

/**
 * ثبت یک Server Component در registry.
 * اگر قبلاً با همین نام ثبت شده، overwrite می‌شود (برای HMR مفید است).
 *
 * @throws اگر comp نامعتبر باشد (بدون name یا render).
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که فقط در صورتی
 *           comp را حذف می‌کند که همان name هنوز به همین comp نگاشت شده باشد.
 */
export function registerServerComponent(comp: ServerComponent): () => void {
  if (!comp || typeof comp.name !== 'string' || comp.name.length === 0) {
    throw developerError(
      'Invalid ServerComponent: name is required.',
      ErrorCode.INTERNAL_DEVELOPER_ERROR,
    );
  }
  if (typeof comp.render !== 'function') {
    throw developerError(
      `Invalid ServerComponent "${comp.name}": render() must be a function.`,
      ErrorCode.INTERNAL_DEVELOPER_ERROR,
    );
  }
  // BUG-SSR-03 FIX (v1.3.0): اگر کامپوننتی با همین نام از قبل ثبت شده باشد،
  // در حالت توسعه یک هشدار چاپ کن. این برای HMR مفید است اما overwrite
  // تصادفی (مثلاً import دوتایی از یک فایل) را هم هشدار می‌دهد.
  if (serverComponentRegistry.has(comp.name)) {
    logger.warn(
      `[Zenith SSR] ServerComponent "${comp.name}" is being overwritten. ` +
        `This is expected during HMR, but if it happens at startup, ` +
        `check for duplicate registrations or conflicting component names.`,
    );
  }
  return serverComponentRegistry.register(comp.name, comp);
}

/**
 * گرفتن یک Server Component از registry.
 * فقط رجیستری owner جاری خوانده می‌شود؛ request/App غایب را با مقدار global
 * پر نمی‌کند. کامپوننت‌های مشترک را صریحاً در RenderOptions.serverComponents بدهید.
 */
export function getServerComponent(name: string): ServerComponent | undefined {
  return serverComponentRegistry.get(name);
}

/**
 * حذف یک Server Component از registry.
 * برای تست‌ها و HMR.
 *
 * @returns true اگر حذف شد، false اگر وجود نداشت.
 */
export function unregisterServerComponent(name: string): boolean {
  return serverComponentRegistry.delete(name);
}

/** #118: بررسی وجود ServerComponent در رجیستری (`hasX`). */
export function hasServerComponent(name: string): boolean {
  return serverComponentRegistry.has(name);
}

/** #118: فهرست نام تمام ServerComponentهای ثبت‌شده (`listXs`). */
export function listServerComponents(): string[] {
  return [...serverComponentRegistry.keys()];
}

/**
 * پاکسازی کل registry.
 * عمدتاً برای تست‌ها.
 * @public @deprecated Use resetForTesting() (@zenith/testing). ZEN-DEPR-060; removed in 2.0.
 */
export function clearServerComponents(): void {
  deprecate('ZEN-DEPR-060', 'clearServerComponents', 'resetForTesting() (@zenith/testing)');
  clearServerComponentsInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearServerComponentsInternal(): void {
  serverComponentRegistry.clear();
}

/* @__PURE__ */ onGlobalReset(clearServerComponentsInternal);
