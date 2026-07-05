// packages/components/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/components`.
//
// استفاده در runtime:
//   import { loadComponents, processComponent, isComponent } from '@zenith/components';
//
// استفاده در تست‌ها یا کاربران پیشرفته:
//   import { registerComponent, clearComponents } from '@zenith/components';

// Import برای استفاده داخلی در loadComponents.
import { registerComponent } from './registry';

// Re-export برای استفاده‌ی کاربران خارجی.
export {
  registerComponent,
  unregisterComponent,
  getComponent,
  isComponent,
  clearComponents,
  componentRegistry,
  type ComponentDefinition,
} from './registry';

export { processComponent } from './processor';

/**
 * FEATURE (v1.2.0): Async Component Loader — restored in v1.2.2.
 *
 * Loads component definitions from remote URLs with an in-memory TTL+maxSize
 * cache. Used by `zen-component` definitions with a `src` attribute and by
 * `<zen-async-component>`-style tags that want runtime fetching.
 *
 * XSS safety: `escapeHTML` is exported for tests and used internally when
 * surfacing error messages. Fetched HTML is parsed via DOMParser and only
 * the `<template>` node is extracted — never innerHTML'd directly.
 */
export {
  loadComponent,
  processAsyncComponent,
  clearComponentCache,
  configureComponentCache,
  escapeHTML,
  type AsyncProcessChildren,
  type ComponentCacheConfig,
  type CacheEntry,
} from './async-loader';

/**
 * بارگذاری تعاریف کامپوننت‌ها از داخل DOM.
 *
 * این تابع باید قبل از walker اصلی فراخوانی شود تا کامپوننت‌ها ثبت شوند
 * و walker بتواند آن‌ها را تشخیص دهد.
 *
 * سینتکس تعریف:
 *   <zen-component name="app-product-card">
 *     <template>
 *       <!-- محتوای کامپوننت -->
 *     </template>
 *   </zen-component>
 *
 * پس از ثبت، تگ <zen-component> از DOM حذف می‌شود (تعریف نباید در صفحه
 * نمایش داده شود).
 *
 * BUG-19 FIX (v1.2.2): lazy loading via `src` attribute. قبلاً چک `if (lazySrc && !template)`
 * مرده بود چون `!template` هیچ‌گاه true نمی‌شد (یک guard قبلی return می‌کرد اگر
 * template نبود). حالا چک `src` قبل از چک `template` انجام می‌شود. اگر `src`
 * وجود داشته باشد، فایل به‌صورت async fetch و parse می‌شود و سپس کامپوننت
 * ثبت می‌گردد (نه-blocking).
 *
 * @param root عنصر ریشه که تعاریف درون آن هستند (معمولاً #app).
 * @returns تعداد کامپوننت‌های ثبت‌شده (برای دیباگ).
 */
export function loadComponents(root: HTMLElement): number {
  // querySelectorAll یک NodeList استاتیک برمی‌گرداند، پس می‌توانیم
  // در حین iteration تگ‌ها را حذف کنیم.
  const defs = root.querySelectorAll('zen-component');
  let count = 0;

  defs.forEach((def) => {
    const name = def.getAttribute('name');

    if (!name) {
      console.warn('[Zenith] <zen-component> without name attribute. Skipping.');
      def.remove();
      return;
    }

    // BUG-19 FIX (v1.2.2): چک `src` را قبل از چک `template` انجام بده. اگر
    // `src` وجود داشته باشد، فایل را async fetch کن (بدون انتظار) و از حلقه
    // خارج شو. این کار اجازه می‌دهد lazy-loaded کامپوننت‌ها بدون block کردن
    // walker اصلی ثبت شوند.
    const lazySrc = def.getAttribute('src');
    if (lazySrc) {
      fetch(lazySrc)
        .then(r => r.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const tpl = doc.querySelector('template');
          if (tpl) {
            registerComponent(name, tpl as HTMLTemplateElement);
          } else {
            console.error(`[Zenith] Lazy component "${name}" from "${lazySrc}" has no <template>.`);
          }
        })
        .catch(err => console.error(`[Zenith] Failed to load lazy component "${name}" from "${lazySrc}":`, err));
      def.remove();
      count++;
      return; // skip the in-DOM template check below
    }

    const template = def.querySelector(':scope > template');
    if (!template) {
      console.warn(`[Zenith] <zen-component name="${name}"> has no <template> child. Skipping.`);
      def.remove();
      return;
    }

    registerComponent(name, template as HTMLTemplateElement);
    count++;
    def.remove(); // حذف تعریف از DOM
  });

  if (count > 0) {
    console.log(`🧩 Loaded ${count} component(s).`);
  }
  return count;
}

/**
 * IMP-COM-03 (v1.3.0): Priority lazy loading of visible components using
 * IntersectionObserver.
 *
 * Components that are visible in the viewport get loaded first (higher
 * priority), while components below the fold load later. This improves
 * perceived performance on pages with many lazy-loaded component
 * definitions.
 *
 * Usage:
 *   // Call after loadComponents() to prioritize visible lazy components.
 *   preloadVisibleComponents();
 *
 * How it works:
 *   1) Queries all elements with `[zen-component]` attribute.
 *   2) Observes them with an IntersectionObserver.
 *   3) When an element scrolls into view, its component is loaded via
 *      the async loader immediately.
 *   4) The observer unobserves the element to avoid redundant work.
 *
 * SSR-safe: no-ops when IntersectionObserver is unavailable.
 */
export function preloadVisibleComponents(): void {
  if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const elements = document.querySelectorAll('[zen-component]');
  if (elements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const componentName = entry.target.getAttribute('zen-component');
          if (componentName) {
            // Trigger the async load: the component will be fetched and
            // registered for use when it's actually needed.
            try {
              // The loadComponent function from async-loader will handle
              // caching, dedup, and TTL.
              import('./async-loader').then(({ loadComponent }) => {
                const src = entry.target.getAttribute('src') || componentName;
                loadComponent(src).catch(() => {
                  // ignore — error already logged inside loadComponent
                });
              });
            } catch { /* ignore */ }
          }
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '200px' }, // Start loading 200px before the element enters viewport
  );

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el) observer.observe(el);
  }
}
