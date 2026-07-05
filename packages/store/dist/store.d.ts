import { type Signal } from '@zenith/state';
/**
 * تعریف یک Store.
 */
export interface StoreDefinition<S, G, A> {
    /** تابع بازگرداندن state اولیه. */
    state: () => S;
    /** Getter ها (computed values). */
    getters?: G & ThisType<StoreContext<S, G, A>>;
    /** Action ها (methods). */
    actions?: A & ThisType<StoreContext<S, G, A>>;
}
/**
 * Context که در getters و actions در دسترس است.
 */
export interface StoreContext<S, G, A> {
    /** State reactive. */
    state: S;
    /** Getter ها. */
    getters: {
        [K in keyof G]: G[K] extends (s: any) => infer R ? R : never;
    };
    /** Action ها. */
    actions: A;
}
/**
 * نوع یک Store ساخته‌شده.
 *
 * نکته: getters به‌صورت Computed objects هستند (نه unwrapped values).
 * برای خواندن مقدار: `store.<getter>.get()`.
 */
export type Store<S, G, A> = {
    /** Signal زیرین state (آبجکت raw). */
    _signal: Signal<S>;
    /** Signal شماره نسخه (هر mutation یک increment). */
    _versionSignal: Signal<number>;
    /** State reactive (می‌توان مستقیماً خواند/نوشت). */
    state: S;
    /** $reset: بازگرداندن state به مقدار اولیه. */
    $reset(): void;
    /** $patch: اعمال patch partial روی state. */
    $patch(partial: Partial<S>): void;
    /** __dispose__: پاکسازی computed signals. */
    __dispose__(): void;
} & {
    [K in keyof G]: G[K] extends (s: any) => infer R ? R : never;
} & {
    [K in keyof A]: A[K];
};
/**
 * تعریف یک Store.
 *
 * @param id   شناسه‌ی یکتای store.
 * @param def  تعریف store (state, getters, actions).
 * @returns تابع استفاده از store.
 */
export declare function defineStore<S, G extends Record<string, (state: S) => any>, A extends Record<string, Function>>(id: string, def: StoreDefinition<S, G, A>): () => Store<S, G, A>;
/**
 * دریافت یک store با ID.
 */
export declare function getStore(id: string): Store<any, any, any> | undefined;
/**
 * پاکسازی همه‌ی store ها (برای تست‌ها).
 */
export declare function clearStores(): void;
