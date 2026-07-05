import { type SignalInfo, type StateChange } from '@zenith/state';
import { type GraphSnapshot } from './graph';
/**
 * نسخه‌ی فریم‌ورک (برای نمایش در DevTools).
 */
export declare const DEVTOOLS_VERSION = "0.1.0";
/**
 * ساختار شیء `window.__ZENITH__` که برای افزونه مرورگر expose می‌شود.
 */
export interface ZenithDevtoolsHook {
    /** نسخه‌ی فریم‌ورک. */
    version: string;
    /** دریافت لیست تمام Signal های فعال. */
    getSignals(): SignalInfo[];
    /** دریافت Timeline تغییرات State. */
    getTimeline(limit?: number): StateChange[];
    /** گوش دادن به تغییرات State (real-time). */
    onStateChange(callback: (change: StateChange) => void): () => void;
    /** Reference به رجیستری کامپوننت‌ها (Map). */
    components: Map<string, HTMLTemplateElement>;
    /** زمان نصب Hook. */
    installedAt: number;
    /** دریافت اسنپ‌شات گراف وابستگی‌ها (Signal → Effect → Directive → DOM). */
    getDependencyGraph(): GraphSnapshot;
    addSignal(id: string, name: string, value: any): void;
    addEffect(id: string, deps?: string[]): void;
    addDirective(id: string, type: string, elementSelector: string, expression?: string): void;
    addDom(id: string, tag: string): void;
    recordRead(signalId: string, effectId: string): void;
    recordWrite(effectId: string, directiveId: string): void;
    recordDomUpdate(directiveId: string, nodeId: string): void;
    clearDependencyGraph(): void;
}
/**
 * نصب DevTools Hook روی `window.__ZENITH__`.
 *
 * این تابع:
 *   1) بررسی می‌کند که در محیط مرورگر هستیم.
 *   2) بررسی می‌کند که DevTools فعال است.
 *   3) یک شیء `ZenithDevtoolsHook` روی `window.__ZENITH__` قرار می‌دهد.
 *   4) یک پیام در console چاپ می‌کند (با استایل).
 *
 * این تابع idempotent است — چندبار فراخوانی آن مشکلی ایجاد نمی‌کند.
 */
export declare function initDevTools(): void;
/**
 * دریافت نسخه‌ی DevTools.
 */
export declare function getDevtoolsVersion(): string;
/**
 * بررسی اینکه آیا Hook نصب شده است.
 */
export declare function isDevtoolsHookInstalled(): boolean;
/**
 * پاکسازی Hook (برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export declare function cleanupDevtools(): void;
//# sourceMappingURL=hook.d.ts.map