export interface HydrationResult {
    success: boolean;
    elementsAdopted: number;
    duration: number;
    error?: string;
    /**
     * FEATURE (v0.4.0): تعداد عناصر داخل مناطق server-component که
     * از آن‌ها attributeهای zen-* حذف شده تا walker واردشان نشود.
     */
    serverComponentsSkipped?: number;
}
/**
 * Deserialize state.
 */
export declare function deserializeState(serializedState: Record<string, any>): Record<string, any>;
/**
 * Hydrate: DOM موجود را به Effectها متصل می‌کند.
 *
 * این تابع فرض می‌کند که HTML از سرور آمده و در DOM موجود است.
 * Zen.start صدا زده می‌شود اما walker به‌جای بازسازی، عناصر موجود را
 * process می‌کند. چون walker قبلاً عناصر را با attribute‌های zen-* پیدا
 * می‌کند و Effect می‌سازد، این کار به‌طور طبیعی "adopt" می‌کند:
 *
 * - zen-text: Effect ساخته می‌شود، textContent اولین بار با مقدار فعلی
 *   set می‌شود (که همان مقدار SSR است) → no visible change.
 * - zen-if: اگر عنصر در DOM است و condition true است → no change.
 *   اگر condition false است → عنصر حذف می‌شود.
 * - zen-for: Effect ساخته می‌شود، اما چون data از state می‌آید (که از
 *   SSR آمده)، آیتم‌های موجود تطابق دارند → no rebuild.
 *
 * نکته: این "true hydration" نیست (در معنی React/Svelte) چون Effectها
 * از نو ساخته می‌شوند. اما از نظر visible behavior، no flicker رخ می‌دهد
 * چون مقادیر اولیه یکسان هستند.
 *
 * @param root     عنصر root.
 * @param initFn   تابع init برای ثبت actions.
 */
export declare function hydrate(root: HTMLElement, initFn?: (state: Record<string, any>) => void): Promise<HydrationResult>;
/**
 * @deprecated از hydrate استفاده کنید.
 */
export declare function startFromSSR(root: HTMLElement, initFn?: (state: Record<string, any>) => void): Promise<HydrationResult>;
export declare function isHydrationMode(): boolean;
export declare function clearHydrationData(): void;
//# sourceMappingURL=hydrate.d.ts.map