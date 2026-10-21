import { createDisposer } from '@zenith/shared';
import { deprecate, onGlobalReset } from '@zenith/errors';
import { Resource } from './engine';
import type { ResourceConfig } from './types';
import { resourceRegistry, resourceRegistrations } from './registry-state';

/**
 * ساخت یا دریافت یک Resource.
 *
 * @param name  نام Resource (مثل 'users').
 * @param config پیکربندی.
 * @returns Resource.
 * @public
 */
export function createResource<T = unknown>(name: string, config: ResourceConfig): Resource<T> {
  const resource = new Resource<T>(config);
  try { registerResource(name, resource); } catch (error) { resource.dispose(); throw error; }
  resourceRegistry.own(() => resource.dispose());
  return resource;
}

/**
 * دریافت یک Resource با نام.
 * @public
 */
export function getResource<T = unknown>(name: string): Resource<T> | undefined {
  return resourceRegistry.get(name) as Resource<T> | undefined;
}

/** #118: ثبت مستقیم Resource در رجیستری با بازگشت Cleanup idempotent.
 * @public
 */
export function registerResource<T = unknown>(name: string, resource: Resource<T>): () => void {
  const release = resourceRegistry.register(name, resource as unknown as Resource<unknown>);
  let registrations = resourceRegistrations.get(resource);
  if (!registrations) { registrations = new Set(); resourceRegistrations.set(resource, registrations); }
  const cleanup = () => { registrations!.delete(cleanup); release(); };
  registrations.add(cleanup); return cleanup;
}

/** #118: بررسی وجود Resource در رجیستری (`hasX`).
 * @public
 */
export function hasResource(name: string): boolean {
  return resourceRegistry.has(name);
}

/** #118: فهرست نام تمام Resourceهای ثبت‌شده (`listXs`).
 * @public
 */
export function listResources(): string[] {
  return Array.from(resourceRegistry.keys());
}

/** #118: حذف یک Resource با نام از رجیستری (`unregisterX`).
 * @public
 */
export function unregisterResource(name: string): boolean {
  const existing = resourceRegistry.get(name);
  if (!existing) return false;
  existing.dispose();
  resourceRegistry.delete(name); return true;
}

/**
 * پاکسازی همه‌ی Resource ها (برای تست‌ها).
 * @public
 */
export function resetResourceRegistry(): void {
  const owned = createDisposer(); for (const resource of resourceRegistry.values()) owned.add(() => resource.dispose());
  try { owned.dispose(); } finally { resourceRegistry.clear(); }
}

/** @public */
export function clearResources(): void {
  deprecate('ZEN-DEPR-058', 'clearResources', 'resetForTesting() (@zenith/testing)');
  clearResourcesInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 * @public
 */
export function clearResourcesInternal(): void {
  const owned = createDisposer(); for (const resource of resourceRegistry.values()) owned.add(() => resource.dispose());
  try { owned.dispose(); } finally { resourceRegistry.clear(); }
}

/* @__PURE__ */ onGlobalReset(clearResourcesInternal);

/**
 * Invalidate همه‌ی Resource ها (مفید بعد از login/logout).
 * @public
 */
export function invalidateAllResources(): void {
  for (const resource of resourceRegistry.values()) {
    resource.invalidate();
  }
}

/**
 * #130: باطل‌سازی Resourceها بر اساس نام/تگ (`invalidate(tags)`).
 * @public
 */
export function invalidate(tags?: string | string[]): void {
  if (!tags) {
    invalidateAllResources();
    return;
  }
  const tagList = Array.isArray(tags) ? tags : [tags];
  if (tagList.length === 0) {
    invalidateAllResources();
    return;
  }
  for (const [name, resource] of resourceRegistry.entries()) {
    if (tagList.includes(name) || tagList.some((t) => name.includes(t))) {
      resource.invalidate();
    }
  }
}
