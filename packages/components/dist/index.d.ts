export { registerComponent, unregisterComponent, getComponent, isComponent, clearComponents, componentRegistry, type ComponentDefinition, } from './registry';
export { processComponent } from './processor';
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
export declare function loadComponents(root: HTMLElement): number;
//# sourceMappingURL=index.d.ts.map