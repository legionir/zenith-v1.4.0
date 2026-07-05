/**
 * قالب `index.html` برای پروژه‌ی جدید.
 */
export declare function indexHtmlTemplate(projectName: string): string;
/**
 * قالب `main.ts` برای پروژه‌ی جدید.
 */
export declare function mainTsTemplate(): string;
/**
 * قالب `vite.config.ts` برای پروژه‌ی جدید.
 */
export declare function viteConfigTemplate(): string;
/**
 * قالب `package.json` برای پروژه‌ی جدید.
 */
export declare function packageJsonTemplate(projectName: string): string;
/**
 * قالب `tsconfig.json` برای پروژه‌ی جدید.
 */
export declare function tsConfigTemplate(): string;
/**
 * قالب `README.md` برای پروژه‌ی جدید.
 */
export declare function readmeTemplate(projectName: string): string;
/**
 * قالب کامپوننت.
 */
export declare function componentTemplate(name: string): string;
/**
 * قالب صفحه (برای SPA).
 */
export declare function pageTemplate(pageName: string): string;
/**
 * قالب Action.
 */
export declare function actionTemplate(actionName: string): string;
/**
 * قالب فایل `.gitignore`.
 */
export declare function gitignoreTemplate(): string;
/**
 * قالب manifest.json برای PWA.
 *
 * این فایل به مرورگر می‌گوید که اپلیکیشن قابل نصب است و
 * هنگام install روی home screen با این متادیتا نمایش داده می‌شود.
 */
export declare function pwaManifestTemplate(projectName: string): string;
/**
 * قالب Service Worker برای PWA.
 *
 * استراتژی‌های caching:
 *   - App Shell (HTML/CSS/JS): stale-while-revalidate
 *   - Images: cache-first با expiration
 *   - API calls: network-first با offline fallback
 *
 * این فایل در root پروژه قرار می‌گیرد و در build به dist/ کپی می‌شود.
 */
export declare function pwaServiceWorkerTemplate(): string;
/**
 * قالب Vite config با PWA plugin.
 *
 * در حالت PWA، vite-plugin-pwa اضافه می‌شود تا به‌طور خودکار
 * service worker را build و manifest را inject کند.
 */
export declare function pwaViteConfigTemplate(): string;
/**
 * قالب main.ts با PWA registration.
 */
export declare function pwaMainTsTemplate(): string;
/**
 * قالب README برای پروژه‌ی PWA.
 */
export declare function pwaReadmeTemplate(projectName: string): string;
//# sourceMappingURL=templates.d.ts.map