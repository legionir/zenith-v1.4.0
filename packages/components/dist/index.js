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
import { registerComponent } from './registry.js';
// Re-export برای استفاده‌ی کاربران خارجی.
export { registerComponent, unregisterComponent, getComponent, isComponent, clearComponents, componentRegistry, } from './registry.js';
export { processComponent } from './processor.js';
/**
 * FEATURE (v1.2.0): Async Component Loader — restored in v1.2.2.
 */
export { loadComponent, processAsyncComponent, clearComponentCache, configureComponentCache, escapeHTML, } from './async-loader.js';
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
 * @param root عنصر ریشه که تعاریف درون آن هستند (معمولاً #app).
 * @returns تعداد کامپوننت‌های ثبت‌شده (برای دیباگ).
 */
export function loadComponents(root) {
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
        // BUG-19 FIX (v1.2.2): چک `src` قبل از چک `template`. اگر src وجود
        // داشته باشد، async fetch کن و از حلقه خارج شو.
        const lazySrc = def.getAttribute('src');
        if (lazySrc) {
            count++;
            def.remove();
            fetch(lazySrc)
                .then(r => {
                if (!r.ok)
                    throw new Error(`HTTP ${r.status}`);
                return r.text();
            })
                .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tpl = doc.querySelector('template');
                if (tpl) {
                    registerComponent(name, tpl);
                    console.log(`🧩 Lazy component "${name}" loaded from "${lazySrc}".`);
                }
                else {
                    console.error(`[Zenith] Lazy component "${name}" from "${lazySrc}" has no <template>.`);
                }
            })
                .catch(err => console.error(`[Zenith] Failed to load lazy component "${name}" from "${lazySrc}":`, err));
            return; // skip the in-DOM template check below
        }
        const template = def.querySelector(':scope > template');
        if (!template) {
            console.warn(`[Zenith] <zen-component name="${name}"> has no <template> child. Skipping.`);
            def.remove();
            return;
        }
        registerComponent(name, template);
        count++;
        def.remove(); // حذف تعریف از DOM
    });
    if (count > 0) {
        console.log(`🧩 Loaded ${count} component(s).`);
    }
    return count;
}
//# sourceMappingURL=index.js.map