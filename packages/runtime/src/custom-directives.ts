import { deprecate, onGlobalReset } from '@zenith/errors';
import { defineOptions, s, type Schema } from '@zenith/schema';
import type { Cleanup } from '@zenith/shared';
import { logger } from '@zenith/logger';
/** A custom tag handler receives caller-owned dynamic context. @public */
export type CustomDirectiveHandler = (
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, unknown>,
  state: Record<string, unknown>,
) => () => void;

/**
 * ثبت‌نام یک custom directive در registry.
 *
 * @param attributeName نام attributeای که به‌عنوان `configAttr` به handler پاس داده می‌شود.
 *                     پیش‌فرض: `'config'`. مثال: برای zen-action-button، `'action'`.
 */
interface CustomDirectiveRegistration {
  attributeName: string;
  handler: CustomDirectiveHandler;
}

const customDirectiveRegistry = new Map<string, CustomDirectiveRegistration>();

/**
 * ثبت یک custom directive برای یک تگ سفارشی.
 *
 * @param tagName       نام تگ (case-insensitive). مثلاً `'zen-resource-view'`.
 * @param handler       تابع پردازشگر.
 * @param attributeName نام attributeای که به‌عنوان `configAttr` استخراج می‌شود.
 *                     پیش‌فرض `'config'`.
 */
/** Custom tag registration configuration. @public */
export interface CustomDirectiveOptions {
  handler: CustomDirectiveHandler;
  attributeName?: string;
}
const registrationOptions = /* @__PURE__ */ defineOptions<CustomDirectiveOptions>('CustomDirectiveOptions', s.object({
  handler: s.fn() as unknown as Schema<CustomDirectiveHandler>,
  attributeName: s.default(s.string(), 'config'),
}));
/** Register a custom tag with explicit configuration. @public */
export function registerCustomDirective(tagName: string, options: CustomDirectiveOptions): Cleanup;
/** @public @deprecated Use registerCustomDirective(tagName, { handler, attributeName }) (ZEN-DEPR-086). */
export function registerCustomDirective(tagName: string, handler: CustomDirectiveHandler, attributeName?: string): Cleanup;
export function registerCustomDirective(
  tagName: string,
  optionsOrHandler: CustomDirectiveOptions | CustomDirectiveHandler,
  legacyAttributeName = 'config',
): Cleanup {
  if (typeof tagName !== 'string' || tagName.length === 0) {
    logger.warn('[Zenith] registerCustomDirective: tagName must be a non-empty string.');
    return () => undefined;
  }
  let handler: CustomDirectiveHandler;
  let attributeName: string;
  if (optionsOrHandler !== null && typeof optionsOrHandler === 'object') {
    const resolved = registrationOptions.resolve(optionsOrHandler);
    handler = resolved.handler; attributeName = resolved.attributeName ?? 'config';
  } else {
    deprecate('ZEN-DEPR-086', 'registerCustomDirective(tag, handler, attribute)', 'registerCustomDirective(tag, { handler, attributeName })');
    handler = optionsOrHandler as CustomDirectiveHandler;
    // Preserve historical default-parameter behavior, including explicit null
    // passed by JavaScript callers; canonical validation is intentionally separate.
    attributeName = legacyAttributeName;
  }
  if (typeof handler !== 'function') {
    logger.warn(`[Zenith] registerCustomDirective: handler for "${tagName}" must be a function.`);
    return () => undefined;
  }
  const key = tagName.toLowerCase();
  const registration = { attributeName, handler };
  customDirectiveRegistry.set(key, registration);
  // #118: قرارداد یکنواخت رجیستری — خروجی Cleanup idempotent با identity-guard.
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (customDirectiveRegistry.get(key) === registration) {
      customDirectiveRegistry.delete(key);
    }
  };
}

/**
 * حذف یک custom directive از registry.
 */
/** @public */
export function unregisterCustomDirective(tagName: string): boolean {
  return customDirectiveRegistry.delete(tagName.toLowerCase());
}

/**
 * پاکسازی کل registry (فقط برای تست‌ها و teardown کامل).
 */
/** @public */
export function clearCustomDirectives(): void {
  deprecate('ZEN-DEPR-062', 'clearCustomDirectives', 'resetForTesting() (@zenith/testing)');
  clearCustomDirectivesInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
/** Internal reset hook; not part of the root facade. @internal */
export function clearCustomDirectivesInternal(): void {
  customDirectiveRegistry.clear();
}

/* @__PURE__ */ onGlobalReset(clearCustomDirectivesInternal);

/**
 * دریافت handler یک custom directive (برای دیباگ و DevTools).
 */
/** @public */
export function getCustomDirective(tagName: string): CustomDirectiveHandler | undefined {
  return customDirectiveRegistry.get(tagName.toLowerCase())?.handler;
}

/**
 * بررسی وجود یک custom directive در registry.
 *
 * @param tagName نام تگ (case-insensitive). مثلاً `'zen-resource-view'`.
 * @returns true اگر directive قبلاً ثبت شده باشد.
 */
/** @public */
export function hasCustomDirective(tagName: string): boolean {
  return customDirectiveRegistry.has(tagName.toLowerCase());
}


/** Private traversal lookup retaining the attribute name. @internal */
export function getCustomDirectiveRegistration(tagName: string): CustomDirectiveRegistration | undefined { return customDirectiveRegistry.get(tagName); }

/** Names are lowercase and returned as a detached snapshot. @public */
export function listCustomDirectives(): string[] { return Array.from(customDirectiveRegistry.keys()); }
