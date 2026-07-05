/**
 * FEATURE (v1.3.0): Type برای ریشه‌ی Event Delegation.
 */
export type DelegationRoot = Document | ShadowRoot | HTMLElement;
/**
 * FEATURE (v1.3.0): Options برای `initEventDelegation`.
 */
export interface InitEventDelegationOptions {
    /**
     * ریشه‌ای که Listener ها روی آن ثبت می‌شوند. پیش‌فرض: `document`.
     */
    root?: DelegationRoot;
}
/**
 * FEATURE (v1.3.0): پاک کردن کل Binding Cache.
 */
export declare function clearBindingCache(): void;
/**
 * FEATURE (v1.3.0): مقداردهی اولیه‌ی Event Delegation روی `root`.
 *
 * @param state   آبجکت State کاربر.
 * @param options FEATURE (v1.3.0): `{ root }` برای custom delegation root.
 * @returns تابع teardown برای حذف تمام Listenerها.
 */
export declare function initEventDelegation(state: Record<string, any>, options?: InitEventDelegationOptions): () => void;
//# sourceMappingURL=delegation.d.ts.map
