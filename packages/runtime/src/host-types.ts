/** Private browser host capabilities. */
export type TeardownFn = () => void;

export interface ZenithRootElement extends HTMLElement {
  __zenithDelegationTeardown?: TeardownFn;
  __zenithDisposes?: (() => void)[];
}

/** globalThis حامل reload function برای HMR (فاز ۱۰). */
export interface ZenithReloadGlobal {
  __ZENITH_RELOAD__?: (changedPath?: string) => void;
}

/** globalThis نگه‌دارندهٔ وضعیت DevTools (window.__ZENITH__ + پرچم dev قدیمی). */
export interface ZenithDevtoolsGlobal {
  __ZENITH__?: { root?: unknown };
  __ZENITH_DEV__?: boolean;
}

