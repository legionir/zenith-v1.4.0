/**
 * Context داده‌شده به هر Action هنگام اجرا.
 *
 * @property event   رویداد اصلی مرورگر (click, keydown, …)
 * @property state   آبجکت State کاربر (همان که به Zen.start داده شد).
 * @property element عنصری که zen-action روی آن تعریف شده (delegate target).
 * @property args    FEATURE (v1.3.0): آرگومان‌های ارزیابی‌شده برای Parameterized Actions.
 */
export interface ActionContext {
    event: Event;
    state: Record<string, any>;
    element: HTMLElement;
    /** FEATURE (v1.3.0): Evaluated arguments for parameterized actions. Undefined when no parens. */
    args?: any[];
}
/**
 * امضای یک Action قابل ثبت در Registry.
 */
export type ActionFn = (ctx: ActionContext) => void | Promise<void>;
/**
 * FEATURE (v1.3.0): متادیتای اختیاری برای Action.
 */
export interface ActionMetadata {
    description?: string;
    category?: string;
    permissions?: string[];
    deprecated?: boolean;
    [key: string]: any;
}
/**
 * FEATURE (v1.3.0): کلاس ActionRegistry — نمونه‌پذیر برای Multi-App.
 */
export declare class ActionRegistry {
    private readonly _actions;
    register(name: string, fn: ActionFn, metadata?: ActionMetadata): this;
    unregister(name: string): boolean;
    get(name: string): ActionFn | undefined;
    getMeta(name: string): ActionMetadata | undefined;
    has(name: string): boolean;
    clear(): void;
    list(): Array<{
        name: string;
        metadata?: ActionMetadata;
    }>;
    get size(): number;
    private _validateName;
    private _validateFn;
}
export declare function registerAction(name: string, fn: ActionFn, metadata?: ActionMetadata): void;
export declare function unregisterAction(name: string): boolean;
export declare function getAction(name: string): ActionFn | undefined;
export declare function getActionMeta(name: string): ActionMetadata | undefined;
export declare function hasAction(name: string): boolean;
export declare function clearActions(): void;
export declare function listActions(): Array<{
    name: string;
    metadata?: ActionMetadata;
}>;
export declare function getDefaultRegistry(): ActionRegistry;
export declare const action: {
    register: typeof registerAction;
    unregister: typeof unregisterAction;
    has: typeof hasAction;
    clear: typeof clearActions;
    list: typeof listActions;
    getMeta: typeof getActionMeta;
};
//# sourceMappingURL=registry.d.ts.map
