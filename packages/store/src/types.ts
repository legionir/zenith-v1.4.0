import type { Signal, Computed } from '@zenith/state';

/** @public */
export interface StorePersistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** @public */
export interface StorePersistOptions<S = unknown> {
  key?: string;
  storage?: StorePersistStorage;
  version?: number;
  migrate?: (persistedState: unknown, oldVersion: number) => S;
  pick?: Array<keyof S & string>;
  omit?: Array<keyof S & string>;
}

/** @public */
export interface StoreActionContext<S = unknown, G = Record<never, never>, A = Record<never, never>> {
  name: string;
  store: Store<S, G, A>;
  args: unknown[];
  after: (cb: (result: unknown) => void) => void;
  onError: (cb: (error: unknown) => void) => void;
}

/** @public */
export type StorePlugin<S = unknown, G = Record<never, never>, A = Record<never, never>> = (context: {
  name: string;
  store: Store<S, G, A>;
  options: StoreDefinition<S, G, A>;
}) => void | (() => void);

/**
 * تعریف یک Store.
 * @public
 */
export interface StoreDefinition<S, G, A> {
  /** تابع بازگرداندن state اولیه. */
  state: () => S;
  /** Getter ها (computed values). */
  getters?: G & ThisType<StoreContext<S, G, A>>;
  /** Action ها (methods). */
  actions?: A & ThisType<StoreContext<S, G, A>>;
  /** #127: پیکربندی اختیاری ذخیره‌سازی پایدار (persist). */
  persist?: boolean | StorePersistOptions<S>;
}

/**
 * Context که در getters و actions در دسترس است.
 * @public
 */
export interface StoreContext<S, G, A> {
  /** State reactive. */
  state: S;
  /** Getter ها. */
  getters: { [K in keyof G]: G[K] extends (...args: never[]) => infer R ? R : never };
  /** Action ها. */
  actions: A;
}

/**
 * نوع یک Store ساخته‌شده.
 *
 * نکته: getters به‌صورت Computed objects هستند (نه unwrapped values).
 * برای خواندن مقدار: `store.<getter>.get()`.
 * @public
 */
export interface StoreBase<S, G, A> {
  /** نام یکتای Store در رجیستری (#118 / #127). */
  readonly $name: string;
  /** شناسهٔ Store (سازگار با نسخهٔ قبلی). */
  readonly $id: string;
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
  /** #127 / #145 — اشتراک تغییرات state → Cleanup. */
  $subscribe(cb: (state: S) => void, options?: { immediate?: boolean }): () => void;
  /** #127 — اشتراک روی فراخوانی اکشن‌ها → Cleanup. */
  $onAction(cb: (ctx: StoreActionContext<S, G, A>) => void): () => void;
  /** #127 — نصب پلاگین روی این Store → Cleanup. */
  use(plugin: StorePlugin<S, G, A>): () => void;
  /** پاکسازی کامل Store و اشتراک‌های آن. */
  dispose(): void;
  /** __dispose__: پاکسازی computed signals. */
  __dispose__(): void;
}

/** Typed action/getter members are installed once by the store factory. @public */
export type Store<S, G, A> = StoreBase<S, G, A> & { [K in keyof G]: G[K] extends (...args: never[]) => infer R ? Computed<R> : never } & { [K in keyof A]: A[K] };

