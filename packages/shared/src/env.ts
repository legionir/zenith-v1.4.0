// packages/shared/src/env.ts
//
// #141 — تشخیص محیط، یک منبع (SPEC §۰.۵: «هرگز در import به window/document
// دست نمی‌زند»). هر تابع هنگام *فراخوانی* بررسی می‌کند، نه هنگام import؛
// به همین دلیل isomorphic است و در Node خالص هم import می‌شود.

/** True اگر در سرور باشیم (no window). */
export function isServer(): boolean {
  return typeof globalThis.window === 'undefined';
}

/** True اگر `window` وجود دارد. */
export function hasWindow(): boolean {
  return typeof globalThis.window !== 'undefined';
}

/** True اگر DOM کامل (`window` + `document`) در دسترس است. */
export function hasDOM(): boolean {
  return typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined';
}
